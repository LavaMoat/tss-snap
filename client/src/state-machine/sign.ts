import { StateMachine, TransitionHandler } from "./machine";
import { KeyShare, SessionInfo, SignMessage } from ".";
import { MessageCache, Message } from "./message-cache";
import { waitFor } from "./wait-for";
import { WebSocketClient } from "../websocket";

export type SignTransition = Message[];
export type SignState = boolean;

export function signMessage(
  websocket: WebSocketClient,
  worker: any,
  onTransition: TransitionHandler<SignState, SignTransition>,
  info: SessionInfo,
  keyShare: KeyShare,
  message: string
): Promise<SignMessage> {
  const peerCache = new MessageCache(info.parameters.threshold);
  const wait = waitFor<SignState, SignTransition>();

  return new Promise(async (resolve) => {
    const machine = new StateMachine<SignState, SignTransition>([
      /*
      {
        name: "SIGN_ROUND_0",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const roundEntry = await worker.signRound0(
            info.parameters,
            info.partySignup,
            keyShare
          );
          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },
      {
        name: "SIGN_ROUND_1",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const answer = transitionData as string[];
          const roundEntry = await worker.signRound1(
            info.parameters,
            info.partySignup,
            keyShare,
            answer
          );
          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },
      {
        name: "SIGN_ROUND_2",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.signRound2(
            info.parameters,
            info.partySignup,
            keyShare,
            previousRoundEntry,
            answer
          );
          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },
      {
        name: "SIGN_ROUND_3",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.signRound3(
            info.parameters,
            info.partySignup,
            keyShare,
            previousRoundEntry,
            answer
          );
          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },
      {
        name: "SIGN_ROUND_4",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.signRound4(
            info.parameters,
            info.partySignup,
            previousRoundEntry,
            answer
          );
          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },
      {
        name: "SIGN_ROUND_5",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.signRound5(
            info.parameters,
            info.partySignup,
            keyShare,
            previousRoundEntry,
            answer,
            message
          );
          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },
      {
        name: "SIGN_ROUND_6",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.signRound6(
            info.parameters,
            info.partySignup,
            previousRoundEntry,
            answer
          );
          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },
      {
        name: "SIGN_ROUND_7",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.signRound7(
            info.parameters,
            info.partySignup,
            previousRoundEntry,
            answer
          );
          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },
      {
        name: "SIGN_ROUND_8",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.signRound8(
            info.parameters,
            info.partySignup,
            previousRoundEntry,
            answer
          );
          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },
      {
        name: "SIGN_ROUND_9",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.signRound9(
            info.parameters,
            info.partySignup,
            previousRoundEntry,
            answer
          );
          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },
      {
        name: "SIGN_FINALIZE",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const signResult = await worker.signMessage(
            info.partySignup,
            keyShare,
            previousRoundEntry,
            answer
          );
          websocket.removeAllListeners("sessionMessage");
          machine.removeAllListeners("transitionEnter");
          resolve(signResult);
          return null;
        },
      },
      */
    ]);

    websocket.on("sessionMessage", async (peerEntry: Message) => {
      peerCache.add(peerEntry);
    });

    machine.on("transitionEnter", onTransition);

    // Start the state machine running
    await machine.next();
  });
}
