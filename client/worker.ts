import init, {
  initThreadPool,
  keygenRound1,
  keygenRound2,
  keygenRound3,
  keygenRound4,
  keygenRound5,
  createKey,
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

interface PartySignup {
  number: number;
  uuid: string;
}

// Opaque type proxied from WASM to the server
interface Entry {
  key: String;
  value: String;
}

interface RoundEntry {
  entry: Entry;
  // Webassembly adds a bunch of temporary properties
  // to each round entry for further rounds but
  // these fields should not be accessed here
  // however we declare their presence in the type
  [x: string]: any;
}

interface PeerEntry {
  party_from: number;
  party_to: number;
  entry: Entry;
}

interface ClientId {
  conn_id: number;
}

interface Parameters {
  parties: number;
  threshold: number;
}

interface Handshake {
  client: ClientId;
  parameters: Parameters;
}

interface KeygenRoundEntry<T> {
  parameters: Parameters;
  partySignup: PartySignup;
  roundEntry: T;
}

interface BroadcastAnswer {
  answer: string[];
}

interface PeerState {
  parties: number;
  received: PeerEntry[];
}

// Opaque type for the final generated key data,
// see the rust `PartyKey` type for details.
interface PartyKey {}

type TransitionData = BroadcastAnswer;
type StateData = Handshake | KeygenRoundEntry<RoundEntry> | PartyKey;

let peerState: PeerState = { parties: 0, received: [] };

const keygen = new StateMachine<StateData, TransitionData>([
  // Handshake to get server parameters and client identifier
  {
    name: "HANDSHAKE",
    transition: async (previousState: StateData): Promise<StateData | null> => {
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
    transition: async (previousState: StateData): Promise<StateData | null> => {
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
      previousState: StateData,
      transitionData: TransitionData
    ): Promise<StateData | null> => {
      postMessage({ type: "round1_complete" });
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
      previousState: StateData,
      transitionData: TransitionData
    ): Promise<StateData | null> => {
      postMessage({ type: "round2_complete" });
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
      previousState: StateData,
      transitionData: TransitionData
    ): Promise<StateData | null> => {
      postMessage({ type: "round3_complete" });
      const keygenRoundEntry = previousState as KeygenRoundEntry<RoundEntry>;
      const { parameters, partySignup } = keygenRoundEntry;

      // Must sort the entries otherwise the decryption
      // keys will not match the peer entries
      peerState.received.sort((a: PeerEntry, b: PeerEntry) => {
        if (a.party_from < b.party_from) return -1;
        if (a.party_from > b.party_from) return 1;
        return 0;
      });

      const answer = peerState.received.map((peer: PeerEntry) => peer.entry);

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
      previousState: StateData,
      transitionData: TransitionData
    ): Promise<StateData | null> => {
      postMessage({ type: "round4_complete" });
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
      previousState: StateData,
      transitionData: TransitionData
    ): Promise<StateData | null> => {
      postMessage({ type: "round5_complete" });
      const keygenRoundEntry = previousState as KeygenRoundEntry<RoundEntry>;
      const { parameters, partySignup } = keygenRoundEntry;
      const { answer } = transitionData as BroadcastAnswer;

      const partyKey = createKey(
        parameters,
        partySignup,
        keygenRoundEntry.roundEntry,
        answer
      );

      return Promise.resolve(partyKey);
    },
  },
]);

// Receive messages sent to the worker
onmessage = async (e) => {
  const { data } = e;
  if (data.type === "party_signup") {
    await keygen.next();
  }
};

// Handle messages from the server that were broadcast
// without a client request
const onBroadcastMessage = async (msg: BroadcastMessage) => {
  switch (msg.kind) {
    case "commitment_answer":
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
          const partyKey = await keygen.next({ answer: msg.data.answer });
          postMessage({ type: "keygen_complete" });
          break;
      }
      return true;
    case "peer_answer":
      const { peer_entry } = msg.data;
      peerState.received.push(peer_entry);

      // Got all the p2p answers
      if (peerState.received.length === peerState.parties - 1) {
        await keygen.next();
      }

      return true;
  }
  return false;
};

const url = "ws://localhost:3030/demo";
const { request } = makeWebSocketClient({
  url,
  onOpen: async () => {
    postMessage({ type: "server", url });
    const handshake = (await keygen.next()) as Handshake;
    postMessage({
      type: "ready",
      ...handshake.parameters,
      ...handshake.client,
    });
  },
  onClose: async () => {},
  onBroadcastMessage,
});
