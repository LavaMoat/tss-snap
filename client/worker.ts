import init, {
  initThreadPool,
  keygenRound1,
  keygenRound2,
  keygenRound3,
  keygenRound4,
  keygenRound5,
  createKey,
  signRound0,
  signRound1,
  signRound2,
  signRound3,
  signRound4,
  signRound5,
  signRound6,
  signRound7,
  signRound8,
  signRound9,
  signMessage,
} from "ecdsa-wasm";

import { makeWebSocketClient, BroadcastMessage } from "./websocket-client";
import { State, StateMachine } from "./state-machine";

// Temporary hack for getRandomValues() error
const getRandomValues = crypto.getRandomValues;
crypto.getRandomValues = function <T extends ArrayBufferView | null>(
  array: T
): T {
  const buffer = new Uint8Array(array as unknown as Uint8Array);
  const value = getRandomValues.call(crypto, buffer);
  (array as unknown as Uint8Array).set(value);
  return array;
};

// For top-level await typescript wants `target` to be es2017
// but this generates a "too much recursion" runtime error so
// we avoid top-level await for now
void (async function () {
  await init();
  await initThreadPool(navigator.hardwareConcurrency);
})();

// Generated by the server to signal this party wants
// to be included in key generation.
interface PartySignup {
  number: number;
  uuid: string;
}

// Encapsulates server handshake information.
interface Handshake {
  client: ClientId;
  parameters: Parameters;
}

// Holds the websocket identifier.
interface ClientId {
  conn_id: number;
}

// Configuration parameters retrieved from the server
// during the handshake.
interface Parameters {
  parties: number;
  threshold: number;
}

// Opaque type proxied from WASM to the server
interface Entry {
  key: string;
  value: string;
}

// Temporary object passed back and forth between javascript
// and webassembly for the various rounds.
interface RoundEntry {
  entry: Entry;
  // Webassembly adds a bunch of temporary properties
  // to each round entry for further rounds but
  // these fields should not be accessed here
  // however we declare their presence in the type
  [x: string]: any;
}

// PeerEntry is sent by the server when relaying messages
// peer to peer during round 3 of key generation.
interface PeerEntry {
  party_from: number;
  party_to: number;
  entry: Entry;
}

// Type to pass through the client state machine during key generation.
interface KeygenRoundEntry<T> {
  parameters: Parameters;
  partySignup: PartySignup;
  roundEntry: T;
}

// Type used to start the signing process.
interface SignInit {
  message: string;
  keygenResult: KeygenResult;
}

// Type to pass through the client state machine during message signing.
interface SignRoundEntry<T> {
  message: string;
  partySignup: PartySignup;
  keygenResult: KeygenResult;
  roundEntry: T;
}

// Type received from the server once all parties have commited
// to a round; contains the answers from the other parties.
interface BroadcastAnswer {
  answer: string[];
}

// Temporary state for caching peer entries during round 3
// of the key generation.
interface PeerState {
  parties: number;
  received: PeerEntry[];
}

// Opaque type for the final generated key data,
// see the rust `PartyKey` type for details.
interface PartyKey {}

// The result from generating a key.
interface KeygenResult {
  parameters: Parameters;
  key: PartyKey;
}

type KeygenTransition = BroadcastAnswer;
type KeygenState = Handshake | KeygenRoundEntry<RoundEntry> | KeygenResult;
type SignState = SignRoundEntry<RoundEntry>;
type SignTransition = SignInit | BroadcastAnswer;

let peerState: PeerState = { parties: 0, received: [] };
let keygenResult: KeygenResult = null;

function getSortedPeerEntriesAnswer(): string[] {
  // Must sort the entries otherwise the decryption
  // keys will not match the peer entries
  peerState.received.sort((a: PeerEntry, b: PeerEntry) => {
    if (a.party_from < b.party_from) return -1;
    if (a.party_from > b.party_from) return 1;
    return 0;
  });
  return peerState.received.map((peer: PeerEntry) => peer.entry.value);
}

function makeOnTransition<T, U>() {
  return (previousState: State<T, U>, nextState: State<T, U>) => {
    let message = "";
    if (previousState) {
      message = `transition from ${previousState.name} to ${nextState.name}`;
    } else {
      message = `transition to ${nextState.name}`;
    }
    console.log(message);
    postMessage({ type: "log", message });
  };
}

const keygen = new StateMachine<KeygenState, KeygenTransition>(
  [
    // Handshake to get server parameters and client identifier
    {
      name: "HANDSHAKE",
      transition: async (
        previousState: KeygenState
      ): Promise<KeygenState | null> => {
        const res = await request({ kind: "parameters" });
        const parameters = {
          parties: res.data.parties,
          threshold: res.data.threshold,
        };
        peerState.parties = res.data.parties;
        const client = { conn_id: res.data.conn_id };
        return Promise.resolve({ parameters, client });
      },
    },
    // Generate the PartySignup and keygen round 1 entry
    {
      name: "KEYGEN_ROUND_1",
      transition: async (
        previousState: KeygenState
      ): Promise<KeygenState | null> => {
        const handshake = previousState as Handshake;
        const { parameters } = handshake;
        const signup = await request({ kind: "party_signup" });
        const { party_signup: partySignup } = signup.data;

        // So the UI thread can show the party number
        postMessage({ type: "party_signup", partySignup });

        // Create the round 1 key entry
        const roundEntry = keygenRound1(partySignup);

        // Send the round 1 entry to the server
        request({
          kind: "keygen_round1",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        const data = { parameters, partySignup, roundEntry };
        return Promise.resolve(data);
      },
    },
    // All parties committed to round 1 so generate the round 2 entry
    {
      name: "KEYGEN_ROUND_2",
      transition: async (
        previousState: KeygenState,
        transitionData: KeygenTransition
      ): Promise<KeygenState | null> => {
        const keygenRoundEntry = previousState as KeygenRoundEntry<RoundEntry>;
        const { parameters, partySignup } = keygenRoundEntry;
        const { answer } = transitionData as BroadcastAnswer;

        // Get round 2 entry using round 1 commitments
        const roundEntry = keygenRound2(
          partySignup,
          keygenRoundEntry.roundEntry,
          answer
        );

        // Send the round 2 entry to the server
        request({
          kind: "keygen_round2",
          data: {
            entry: roundEntry.entry,
            uuid: keygenRoundEntry.partySignup.uuid,
          },
        });

        const data = { parameters, partySignup, roundEntry };
        return Promise.resolve(data);
      },
    },
    // All parties committed to round 2 so generate the round 3 peer to peer calls
    {
      name: "KEYGEN_ROUND_3",
      transition: async (
        previousState: KeygenState,
        transitionData: KeygenTransition
      ): Promise<KeygenState | null> => {
        const keygenRoundEntry = previousState as KeygenRoundEntry<RoundEntry>;
        const { parameters, partySignup } = keygenRoundEntry;
        const { answer } = transitionData as BroadcastAnswer;

        const roundEntry = keygenRound3(
          parameters,
          partySignup,
          keygenRoundEntry.roundEntry,
          answer
        );

        // Send the round 3 entry to the server
        request({
          kind: "keygen_round3_relay_peers",
          data: { entries: roundEntry.peer_entries },
        });

        const data = { parameters, partySignup, roundEntry };
        return Promise.resolve(data);
      },
    },
    // Got all the round 3 peer to peer messages, proceed to round  4
    {
      name: "KEYGEN_ROUND_4",
      transition: async (
        previousState: KeygenState,
        transitionData: KeygenTransition
      ): Promise<KeygenState | null> => {
        const keygenRoundEntry = previousState as KeygenRoundEntry<RoundEntry>;
        const { parameters, partySignup } = keygenRoundEntry;

        const answer = getSortedPeerEntriesAnswer();
        // Clean up the peer entries
        peerState.received = [];

        const roundEntry = keygenRound4(
          parameters,
          partySignup,
          keygenRoundEntry.roundEntry,
          answer
        );

        // Send the round 4 entry to the server
        request({
          kind: "keygen_round4",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        const data = { parameters, partySignup, roundEntry };
        return Promise.resolve(data);
      },
    },
    // Got all the round 4 entries
    {
      name: "KEYGEN_ROUND_5",
      transition: async (
        previousState: KeygenState,
        transitionData: KeygenTransition
      ): Promise<KeygenState | null> => {
        const keygenRoundEntry = previousState as KeygenRoundEntry<RoundEntry>;
        const { parameters, partySignup } = keygenRoundEntry;
        const { answer } = transitionData as BroadcastAnswer;

        const roundEntry = keygenRound5(
          parameters,
          partySignup,
          keygenRoundEntry.roundEntry,
          answer
        );

        // Send the round 5 entry to the server
        request({
          kind: "keygen_round5",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        const data = { parameters, partySignup, roundEntry };
        return Promise.resolve(data);
      },
    },
    // Got all the round 5 entries, create the final key data
    {
      name: "KEYGEN_FINALIZE",
      transition: async (
        previousState: KeygenState,
        transitionData: KeygenTransition
      ): Promise<KeygenState | null> => {
        const keygenRoundEntry = previousState as KeygenRoundEntry<RoundEntry>;
        const { parameters, partySignup } = keygenRoundEntry;
        const { answer } = transitionData as BroadcastAnswer;

        const key: PartyKey = createKey(
          parameters,
          partySignup,
          keygenRoundEntry.roundEntry,
          answer
        );

        return Promise.resolve({ parameters, partySignup, key });
      },
    },
  ],
  makeOnTransition<KeygenState, KeygenTransition>()
);

// State machine for signing a proposal
const sign = new StateMachine<SignState, SignTransition>(
  [
    // Start the signing process.
    {
      name: "SIGN_ROUND_0",
      transition: async (
        previousState: SignState,
        transitionData: SignTransition
      ): Promise<SignState | null> => {
        // Generate a new party signup for the sign phase
        const signup = await request({ kind: "party_signup" });
        const { party_signup: partySignup } = signup.data;

        // So the UI thread can update the party number for the sign phase
        postMessage({ type: "party_signup", partySignup });

        const { message, keygenResult } = transitionData as SignInit;
        const { key } = keygenResult;
        const roundEntry = signRound0(partySignup, key);

        // Send the round 0 entry to the server
        request({
          kind: "sign_round0",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        return Promise.resolve({
          message,
          partySignup,
          keygenResult,
          roundEntry,
        });
      },
    },
    {
      name: "SIGN_ROUND_1",
      transition: async (
        previousState: SignState,
        transitionData: SignTransition
      ): Promise<SignState | null> => {
        const { message, partySignup, keygenResult } =
          previousState as SignRoundEntry<RoundEntry>;
        const { parameters, key } = keygenResult;
        const { answer } = transitionData as BroadcastAnswer;
        const roundEntry = signRound1(parameters, partySignup, key, answer);

        // Set up for the peer to peer calls in round 2
        peerState.parties = parameters.threshold + 1;
        peerState.received = [];

        // Send the round 1 entry to the server
        request({
          kind: "sign_round1",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        return Promise.resolve({
          message,
          partySignup,
          keygenResult,
          roundEntry,
        });
      },
    },
    {
      name: "SIGN_ROUND_2",
      transition: async (
        previousState: SignState,
        transitionData: SignTransition
      ): Promise<SignState | null> => {
        const signState = previousState as SignRoundEntry<RoundEntry>;
        const { message, partySignup, keygenResult } = signState;
        const { parameters, key } = keygenResult;
        const { answer } = transitionData as BroadcastAnswer;

        const roundEntry = signRound2(
          parameters,
          partySignup,
          key,
          signState.roundEntry,
          answer
        );

        // Send the round 2 entry to the server
        request({
          kind: "sign_round2_relay_peers",
          data: { entries: roundEntry.peer_entries },
        });

        return Promise.resolve({
          message,
          partySignup,
          keygenResult,
          roundEntry,
        });
      },
    },
    {
      name: "SIGN_ROUND_3",
      transition: async (
        previousState: SignState,
        transitionData: SignTransition
      ): Promise<SignState | null> => {
        const signState = previousState as SignRoundEntry<RoundEntry>;
        const { message, partySignup, keygenResult } = signState;
        const { parameters, key } = keygenResult;

        const answer = getSortedPeerEntriesAnswer();
        // Clean up the peer entries
        peerState.received = [];

        const roundEntry = signRound3(
          parameters,
          partySignup,
          key,
          signState.roundEntry,
          answer
        );

        // Send the round 3 entry to the server
        request({
          kind: "sign_round3",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        return Promise.resolve({
          message,
          partySignup,
          keygenResult,
          roundEntry,
        });
      },
    },
    {
      name: "SIGN_ROUND_4",
      transition: async (
        previousState: SignState,
        transitionData: SignTransition
      ): Promise<SignState | null> => {
        const signState = previousState as SignRoundEntry<RoundEntry>;
        const { message, partySignup, keygenResult } = signState;
        const { answer } = transitionData as BroadcastAnswer;

        const roundEntry = signRound4(
          partySignup,
          signState.roundEntry,
          answer
        );

        // Send the round 4 entry to the server
        request({
          kind: "sign_round4",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        return Promise.resolve({
          message,
          partySignup,
          keygenResult,
          roundEntry,
        });
      },
    },
    {
      name: "SIGN_ROUND_5",
      transition: async (
        previousState: SignState,
        transitionData: SignTransition
      ): Promise<SignState | null> => {
        const signState = previousState as SignRoundEntry<RoundEntry>;
        const { message, partySignup, keygenResult } = signState;
        const { key } = keygenResult;
        const { answer } = transitionData as BroadcastAnswer;

        const encoder = new TextEncoder();
        // NOTE: UInt8Array serializes to a map but we want
        // NOTE: a Vec<u8> in webassembly so must call Array.from()
        const messageBytes = Array.from(encoder.encode(message));

        const roundEntry = signRound5(
          partySignup,
          key,
          signState.roundEntry,
          answer,
          messageBytes
        );

        // Send the round 5 entry to the server
        request({
          kind: "sign_round5",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        return Promise.resolve({
          message,
          partySignup,
          keygenResult,
          roundEntry,
        });
      },
    },
    {
      name: "SIGN_ROUND_6",
      transition: async (
        previousState: SignState,
        transitionData: SignTransition
      ): Promise<SignState | null> => {
        const signState = previousState as SignRoundEntry<RoundEntry>;
        const { message, partySignup, keygenResult } = signState;
        const { answer } = transitionData as BroadcastAnswer;

        const roundEntry = signRound6(
          partySignup,
          signState.roundEntry,
          answer
        );

        // Send the round 6 entry to the server
        request({
          kind: "sign_round6",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        return Promise.resolve({
          message,
          partySignup,
          keygenResult,
          roundEntry,
        });
      },
    },
    {
      name: "SIGN_ROUND_7",
      transition: async (
        previousState: SignState,
        transitionData: SignTransition
      ): Promise<SignState | null> => {
        const signState = previousState as SignRoundEntry<RoundEntry>;
        const { message, partySignup, keygenResult } = signState;
        const { parameters } = keygenResult;
        const { answer } = transitionData as BroadcastAnswer;

        const roundEntry = signRound7(
          parameters,
          partySignup,
          signState.roundEntry,
          answer
        );

        // Send the round 7 entry to the server
        request({
          kind: "sign_round7",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        return Promise.resolve({
          message,
          partySignup,
          keygenResult,
          roundEntry,
        });
      },
    },
    {
      name: "SIGN_ROUND_8",
      transition: async (
        previousState: SignState,
        transitionData: SignTransition
      ): Promise<SignState | null> => {
        const signState = previousState as SignRoundEntry<RoundEntry>;
        const { message, partySignup, keygenResult } = signState;
        const { answer } = transitionData as BroadcastAnswer;

        const roundEntry = signRound8(
          partySignup,
          signState.roundEntry,
          answer
        );

        // Send the round 8 entry to the server
        request({
          kind: "sign_round8",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        return Promise.resolve({
          message,
          partySignup,
          keygenResult,
          roundEntry,
        });
      },
    },
    {
      name: "SIGN_ROUND_9",
      transition: async (
        previousState: SignState,
        transitionData: SignTransition
      ): Promise<SignState | null> => {
        const signState = previousState as SignRoundEntry<RoundEntry>;
        const { message, partySignup, keygenResult } = signState;
        const { parameters } = keygenResult;
        const { answer } = transitionData as BroadcastAnswer;

        const roundEntry = signRound9(
          parameters,
          partySignup,
          signState.roundEntry,
          answer
        );

        // Send the round 9 entry to the server
        request({
          kind: "sign_round9",
          data: {
            entry: roundEntry.entry,
            uuid: partySignup.uuid,
          },
        });

        return Promise.resolve({
          message,
          partySignup,
          keygenResult,
          roundEntry,
        });
      },
    },
    {
      name: "SIGN_FINALIZE",
      transition: async (
        previousState: SignState,
        transitionData: SignTransition
      ): Promise<SignState | null> => {
        const signState = previousState as SignRoundEntry<RoundEntry>;
        const { message, partySignup, keygenResult } = signState;
        const { parameters, key } = keygenResult;
        const { answer } = transitionData as BroadcastAnswer;

        const signResult = signMessage(
          partySignup,
          key,
          signState.roundEntry,
          answer
        );

        postMessage({ type: "sign_result", signResult });

        return Promise.resolve(null);
      },
    },
  ],
  makeOnTransition<SignState, SignTransition>()
);

// Receive messages sent to the worker
onmessage = async (e) => {
  const { data } = e;
  if (data.type === "party_signup") {
    await keygen.next();
  } else if (data.type === "sign_proposal") {
    const { message } = data;
    send({ kind: "sign_proposal", data: { message } });
  } else if (data.type === "sign_message") {
    const { message } = data;
    await sign.next({ message, keygenResult });
  }
};

// Handle messages from the server that were broadcast
// without a client request
const onBroadcastMessage = async (msg: BroadcastMessage) => {
  switch (msg.kind) {
    case "keygen_commitment_answer":
      switch (msg.data.round) {
        case "round1":
          await keygen.next({ answer: msg.data.answer });
          break;
        case "round2":
          await keygen.next({ answer: msg.data.answer });
          break;
        case "round4":
          await keygen.next({ answer: msg.data.answer });
          break;
        case "round5":
          keygenResult = (await keygen.next({
            answer: msg.data.answer,
          })) as KeygenResult;
          postMessage({ type: "keygen_complete" });
          break;
      }
      return true;
    case "keygen_peer_answer":
      const { peer_entry: keygenPeerEntry } = msg.data;
      peerState.received.push(keygenPeerEntry);

      // Got all the p2p answers
      if (peerState.received.length === peerState.parties - 1) {
        await keygen.next();
      }

      return true;
    case "sign_proposal":
      const { message } = msg.data;
      postMessage({ type: "sign_proposal", message });
      return true;
    case "sign_progress":
      // Parties that did not commit to signing should update the UI only
      postMessage({ type: "sign_progress" });

      // Parties not participating in the signing should reset their party number
      postMessage({
        type: "party_signup",
        partySignup: { number: 0, uuid: "" },
      });
      return true;
    case "sign_commitment_answer":
      switch (msg.data.round) {
        case "round0":
          // We performed a sign of the message and also need to update the UI
          postMessage({ type: "sign_progress" });
          await sign.next({ answer: msg.data.answer });
          break;
        case "round1":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round3":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round4":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round5":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round6":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round7":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round8":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round9":
          await sign.next({ answer: msg.data.answer });
          break;
      }
      return true;
    case "sign_peer_answer":
      const { peer_entry: signPeerEntry } = msg.data;
      peerState.received.push(signPeerEntry);

      // Got all the p2p answers
      if (peerState.received.length === peerState.parties - 1) {
        await sign.next();
      }

      return true;
  }
  return false;
};

const url = "ws://localhost:3030/demo";
const { send, request } = makeWebSocketClient({
  url,
  onOpen: async () => {
    postMessage({ type: "connected", url });
    const handshake = (await keygen.next()) as Handshake;
    postMessage({
      type: "ready",
      ...handshake.parameters,
      ...handshake.client,
    });
  },
  onClose: async () => {
    postMessage({ type: "disconnected" });
  },
  onBroadcastMessage,
});
