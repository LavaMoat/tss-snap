import {
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
import { StateMachine } from "./state-machine";
import {
  KeygenResult,
  PartySignup,
  RoundEntry,
  BroadcastAnswer,
  makeOnTransition,
} from "./machine-common";
import { BroadcastMessage } from "./websocket-client";
import {
  getSortedPeerEntriesAnswer,
  PeerEntryHandler,
  makePeerState,
} from "./peer-state";

// Type used to start the signing process.
interface SignInit {
  message: string;
  keygenResult: KeygenResult;
}

interface SignPartySignupInfo {
  message: string;
  keygenResult: KeygenResult;
  partySignup: PartySignup;
}

// Type to pass through the client state machine during message signing.
interface SignRoundEntry<T> {
  message: string;
  partySignup: PartySignup;
  keygenResult: KeygenResult;
  roundEntry: T;
}

export type SignState = SignPartySignupInfo | SignRoundEntry<RoundEntry>;
export type SignTransition = SignInit | BroadcastAnswer;

export interface SignMessageMachineContainer {
  machine: StateMachine<SignState, SignTransition>;
  onBroadcastMessage: Function;
}

export function makeSignMessageStateMachine(
  sendNetworkRequest: Function,
  sendUiMessage: Function,
  sendNetworkMessage: Function
) {
  let peerEntryHandler: PeerEntryHandler = null;

  // State machine for signing a proposal
  const machine = new StateMachine<SignState, SignTransition>(
    [
      // Start the signing process.
      {
        name: "SIGN_PARTY_SIGNUP",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const { message, keygenResult } = transitionData as SignInit;
          const { parameters } = keygenResult;

          // Generate a new party signup for the sign phase
          const signup = await sendNetworkRequest({
            kind: "party_signup",
            data: { phase: "sign" },
          });
          const { party_signup: partySignup } = signup.data;

          // So the UI thread can update the party number for the sign phase
          sendUiMessage({ type: "party_signup", partySignup });

          // NOTE: We don't add 1 to threshold here as
          // NOTE: we only expect answers from *other* peers
          peerEntryHandler = makePeerState(parameters.threshold);

          return {
            message,
            partySignup,
            keygenResult,
          };
        },
      },

      // Start the signing process.
      {
        name: "SIGN_ROUND_0",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const { message, keygenResult, partySignup } =
            previousState as SignPartySignupInfo;
          const { key, parameters } = keygenResult;
          const roundEntry = signRound0(parameters, partySignup, key);

          // Send the round 0 entry to the server
          sendNetworkMessage({
            kind: "peer_relay",
            data: { entries: roundEntry.peer_entries },
          });

          return {
            message,
            partySignup,
            keygenResult,
            roundEntry,
          };
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

          // Send the round 1 entry to the server
          sendNetworkMessage({
            kind: "peer_relay",
            data: { entries: roundEntry.peer_entries },
          });

          return {
            message,
            partySignup,
            keygenResult,
            roundEntry,
          };
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
          sendNetworkMessage({
            kind: "peer_relay",
            data: { entries: roundEntry.peer_entries },
          });

          return {
            message,
            partySignup,
            keygenResult,
            roundEntry,
          };
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
          const { answer } = transitionData as BroadcastAnswer;

          const roundEntry = signRound3(
            parameters,
            partySignup,
            key,
            signState.roundEntry,
            answer
          );

          // Send the round 3 entry to the server
          sendNetworkMessage({
            kind: "peer_relay",
            data: { entries: roundEntry.peer_entries },
          });

          return {
            message,
            partySignup,
            keygenResult,
            roundEntry,
          };
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
          const { parameters } = keygenResult;
          const { answer } = transitionData as BroadcastAnswer;

          const roundEntry = signRound4(
            parameters,
            partySignup,
            signState.roundEntry,
            answer
          );

          // Send the round 4 entry to the server
          sendNetworkMessage({
            kind: "peer_relay",
            data: { entries: roundEntry.peer_entries },
          });

          return {
            message,
            partySignup,
            keygenResult,
            roundEntry,
          };
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
          const { key, parameters } = keygenResult;
          const { answer } = transitionData as BroadcastAnswer;

          const roundEntry = signRound5(
            parameters,
            partySignup,
            key,
            signState.roundEntry,
            answer,
            message
          );

          // Send the round 5 entry to the server
          sendNetworkMessage({
            kind: "peer_relay",
            data: { entries: roundEntry.peer_entries },
          });

          return {
            message,
            partySignup,
            keygenResult,
            roundEntry,
          };
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
          sendNetworkRequest({
            kind: "sign_round6",
            data: {
              entry: roundEntry.entry,
              uuid: partySignup.uuid,
            },
          });

          return {
            message,
            partySignup,
            keygenResult,
            roundEntry,
          };
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
          sendNetworkRequest({
            kind: "sign_round7",
            data: {
              entry: roundEntry.entry,
              uuid: partySignup.uuid,
            },
          });

          return {
            message,
            partySignup,
            keygenResult,
            roundEntry,
          };
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
          sendNetworkRequest({
            kind: "sign_round8",
            data: {
              entry: roundEntry.entry,
              uuid: partySignup.uuid,
            },
          });

          return {
            message,
            partySignup,
            keygenResult,
            roundEntry,
          };
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
          sendNetworkRequest({
            kind: "sign_round9",
            data: {
              entry: roundEntry.entry,
              uuid: partySignup.uuid,
            },
          });

          return {
            message,
            partySignup,
            keygenResult,
            roundEntry,
          };
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

          // Update the UI
          sendUiMessage({ type: "sign_result", signResult });

          // Notify non-participants of the signed message
          sendNetworkMessage({
            kind: "sign_result",
            data: { sign_result: signResult, uuid: partySignup.uuid },
          });

          return signResult;
        },
      },
    ],
    {
      onTransition: makeOnTransition<SignState, SignTransition>(sendUiMessage),
    }
  );

  // Handle messages from the server that were broadcast
  // without a client request
  async function onBroadcastMessage(msg: BroadcastMessage) {
    switch (msg.kind) {
      case "party_signup":
        await machine.next();
        return true;
      case "sign_proposal":
        const { message } = msg.data;
        sendUiMessage({ type: "sign_proposal", message });
        return true;
      case "sign_progress":
        // Parties that did not commit to signing should update the UI only
        sendUiMessage({ type: "sign_progress" });

        // Parties not participating in the signing should reset their party number
        sendUiMessage({
          type: "party_signup",
          partySignup: { number: 0, uuid: "" },
        });
        return true;
      case "sign_commitment_answer":
        switch (msg.data.round) {
          case "round0":
            // We performed a sign of the message and also need to update the UI
            sendUiMessage({ type: "sign_progress" });
            //await machine.next({ answer: msg.data.answer });
            break;
          case "round6":
            await machine.next({ answer: msg.data.answer });
            break;
          case "round7":
            await machine.next({ answer: msg.data.answer });
            break;
          case "round8":
            await machine.next({ answer: msg.data.answer });
            break;
          case "round9":
            await machine.next({ answer: msg.data.answer });
            break;
        }
        return true;
      case "peer_relay":
        const { peer_entry: peerEntry } = msg.data;
        const answer = peerEntryHandler(peerEntry);
        // Got all the p2p answers
        if (answer) {
          await machine.next({ answer });
        }
        return true;
      case "sign_result":
        const { sign_result: signResult } = msg.data;
        // Update the UI
        sendUiMessage({ type: "sign_result", signResult });
        return true;
    }
    return false;
  }

  return { machine, onBroadcastMessage };
}
