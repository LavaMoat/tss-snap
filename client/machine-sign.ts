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
import { State, StateMachine } from "./state-machine";
import {
  KeygenResult,
  PartySignup,
  RoundEntry,
  BroadcastAnswer,
  PeerState,
  getSortedPeerEntriesAnswer,
  makeOnTransition,
} from "./machine-common";
import {} from "./machine-keygen";

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

type SignState = SignRoundEntry<RoundEntry>;
type SignTransition = SignInit | BroadcastAnswer;

export function makeSignMessageStateMachine(
  peerState: PeerState,
  request: Function,
  postMessage: Function,
  send: Function
) {
  // State machine for signing a proposal
  return new StateMachine<SignState, SignTransition>(
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

          const answer = getSortedPeerEntriesAnswer(peerState);
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

          //const encoder = new TextEncoder();
          //const messageBytes = encoder.encode(message);
          //const messageHex = toHexString(messageBytes);

          const roundEntry = signRound5(
            partySignup,
            key,
            signState.roundEntry,
            answer,
            message
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

          // Update the UI
          postMessage({ type: "sign_result", signResult });

          // Notify non-participants of the signed message
          send({
            kind: "sign_result",
            data: { sign_result: signResult, uuid: partySignup.uuid },
          });

          return Promise.resolve(null);
        },
      },
    ],
    makeOnTransition<SignState, SignTransition>(postMessage)
  );
}
