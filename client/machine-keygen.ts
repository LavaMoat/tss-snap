import {
  keygenRound1,
  keygenRound2,
  keygenRound3,
  keygenRound4,
  keygenRound5,
  createKey,
} from "ecdsa-wasm";
import { StateMachine } from "./state-machine";
import {
  Parameters,
  PartySignup,
  PartySignupInfo,
  KeygenResult,
  PartyKey,
  RoundEntry,
  BroadcastAnswer,
  Handshake,
  makeOnTransition,
} from "./machine-common";
import { BroadcastMessage } from "./websocket-client";
import { makePeerState, PeerEntryHandler } from "./peer-state";

// Type to pass through the client state machine during key generation.
interface KeygenRoundEntry<T> {
  parameters: Parameters;
  partySignup: PartySignup;
  roundEntry: T;
}

export type KeygenTransition = BroadcastAnswer;
export type KeygenState =
  | Handshake
  | PartySignupInfo
  | KeygenRoundEntry<RoundEntry>
  | KeygenResult;

export function makeKeygenStateMachine(
  sendNetworkRequest: Function,
  sendUiMessage: Function,
  sendNetworkMessage: Function
) {
  let peerEntryHandler: PeerEntryHandler = null;

  const machine = new StateMachine<KeygenState, KeygenTransition>(
    [
      // Handshake to get server parameters and client identifier
      {
        name: "HANDSHAKE",
        transition: async (
          previousState: KeygenState
        ): Promise<KeygenState | null> => {
          const res = await sendNetworkRequest({ kind: "parameters" });
          const parameters = {
            parties: res.data.parties,
            threshold: res.data.threshold,
          };

          peerEntryHandler = makePeerState(res.data.parties - 1);

          const client = { conn_id: res.data.conn_id };
          return { parameters, client };
        },
      },
      // Generate the PartySignup
      {
        name: "PARTY_SIGNUP",
        transition: async (
          previousState: KeygenState
        ): Promise<KeygenState | null> => {
          const handshake = previousState as Handshake;
          const { parameters } = handshake;
          const signup = await sendNetworkRequest({
            kind: "party_signup",
            data: { phase: "keygen" },
          });
          const { party_signup: partySignup } = signup.data;

          // So the UI thread can show the party number
          sendUiMessage({ type: "party_signup", partySignup });

          return { parameters, partySignup };
        },
      },
      // Generate the PartySignup and keygen round 1 entry
      {
        name: "KEYGEN_ROUND_1",
        transition: async (
          previousState: KeygenState
        ): Promise<KeygenState | null> => {
          const partySignupInfo = previousState as PartySignupInfo;
          const { parameters, partySignup } = partySignupInfo;

          // Create the round 1 key entry
          const roundEntry = keygenRound1(parameters, partySignup);

          // Send the round 1 entry to the server
          sendNetworkMessage({
            kind: "peer_relay",
            data: { entries: roundEntry.peer_entries },
          });

          return { parameters, partySignup, roundEntry };
        },
      },
      // All parties committed to round 1 so generate the round 2 entry
      {
        name: "KEYGEN_ROUND_2",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const keygenRoundEntry =
            previousState as KeygenRoundEntry<RoundEntry>;
          const { parameters, partySignup } = keygenRoundEntry;
          const { answer } = transitionData as BroadcastAnswer;

          // Get round 2 entry using round 1 commitments
          const roundEntry = keygenRound2(
            parameters,
            partySignup,
            keygenRoundEntry.roundEntry,
            answer
          );

          // Send the round 2 entry to the server
          sendNetworkMessage({
            kind: "peer_relay",
            data: { entries: roundEntry.peer_entries },
          });

          return { parameters, partySignup, roundEntry };
        },
      },
      // All parties committed to round 2 so generate the round 3 peer to peer calls
      {
        name: "KEYGEN_ROUND_3",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const keygenRoundEntry =
            previousState as KeygenRoundEntry<RoundEntry>;
          const { parameters, partySignup } = keygenRoundEntry;
          const { answer } = transitionData as BroadcastAnswer;

          const roundEntry = keygenRound3(
            parameters,
            partySignup,
            keygenRoundEntry.roundEntry,
            answer
          );

          // Send the round 3 entry to the server
          sendNetworkMessage({
            kind: "peer_relay",
            data: { entries: roundEntry.peer_entries },
          });

          return { parameters, partySignup, roundEntry };
        },
      },
      // Got all the round 3 peer to peer messages, proceed to round  4
      {
        name: "KEYGEN_ROUND_4",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const keygenRoundEntry =
            previousState as KeygenRoundEntry<RoundEntry>;
          const { parameters, partySignup } = keygenRoundEntry;
          const { answer } = transitionData as BroadcastAnswer;

          const roundEntry = keygenRound4(
            parameters,
            partySignup,
            keygenRoundEntry.roundEntry,
            answer
          );

          // Send the round 4 entry to the server
          sendNetworkMessage({
            kind: "peer_relay",
            data: { entries: roundEntry.peer_entries },
          });

          return { parameters, partySignup, roundEntry };
        },
      },
      // Got all the round 4 entries
      {
        name: "KEYGEN_ROUND_5",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const keygenRoundEntry =
            previousState as KeygenRoundEntry<RoundEntry>;
          const { parameters, partySignup } = keygenRoundEntry;
          const { answer } = transitionData as BroadcastAnswer;

          const roundEntry = keygenRound5(
            parameters,
            partySignup,
            keygenRoundEntry.roundEntry,
            answer
          );

          // Send the round 5  entry to the server
          sendNetworkMessage({
            kind: "peer_relay",
            data: { entries: roundEntry.peer_entries },
          });

          return { parameters, partySignup, roundEntry };
        },
      },
      // Got all the round 5 entries, create the final key data
      {
        name: "KEYGEN_FINALIZE",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const keygenRoundEntry =
            previousState as KeygenRoundEntry<RoundEntry>;
          const { parameters, partySignup } = keygenRoundEntry;
          const { answer } = transitionData as BroadcastAnswer;

          const key: PartyKey = createKey(
            parameters,
            partySignup,
            keygenRoundEntry.roundEntry,
            answer
          );

          sendUiMessage({ type: "keygen_complete" });

          return { parameters, partySignup, key };
        },
      },
    ],
    {
      onTransition: makeOnTransition<KeygenState, KeygenTransition>(
        sendUiMessage
      ),
    }
  );

  // Handle messages from the server that were broadcast
  // without a client request
  async function onBroadcastMessage(msg: BroadcastMessage) {
    switch (msg.kind) {
      case "party_signup":
        await machine.next();
        return true;
      case "peer_relay":
        const { peer_entry: peerEntry } = msg.data;
        const answer = peerEntryHandler(peerEntry);
        // Got all the p2p answers
        if (answer) {
          await machine.next({ answer });
        }
        return true;
    }
    return false;
  }

  return { machine, onBroadcastMessage };
}
