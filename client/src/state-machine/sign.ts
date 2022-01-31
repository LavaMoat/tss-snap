import { StateMachine, TransitionHandler } from "./machine";
import { KeyShare, SessionInfo, SignMessage } from ".";
import { MessageCache, Message } from "./message-cache";
import { waitFor } from "./wait-for";
import { WebSocketClient } from "../websocket";

export type SignTransition = Message[];
export type SignState = boolean;

export async function signMessage(
  websocket: WebSocketClient,
  worker: any,
  onTransition: TransitionHandler<SignState, SignTransition>,
  info: SessionInfo,
  keyShare: KeyShare,
  message: string
): Promise<SignMessage> {
  const incomingMessageCache = new MessageCache(info.parameters.threshold);
  const wait = waitFor<SignState, SignTransition>();

  // FIXME: compute signing participants
  const participants = [1, 2];

  await worker.signInit(
    info.partySignup.number,
    participants,
    keyShare.localKey
  );

  return new Promise(async (resolve) => {
    const machine = new StateMachine<SignState, SignTransition>([
      {
        name: "SIGN_ROUND_1",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const messages = await worker.signProceed();
          console.log("Got sign round 1 messages", messages);
          wait(websocket, info, machine, incomingMessageCache, messages);
          return true;
        },
      },
      {
        name: "SIGN_ROUND_2",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const incoming = transitionData as Message[];
          for (const message of incoming) {
            await worker.signHandleIncoming(message);
          }

          const messages = await worker.signProceed();
          wait(websocket, info, machine, incomingMessageCache, messages);
          return true;
        },
      },
      {
        name: "SIGN_ROUND_3",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          console.log("Handle sign round 3");
          return null;
        },
      },
      /*
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
          wait(websocket, info, machine, incomingMessageCache, roundEntry.peer_entries);
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
          wait(websocket, info, machine, incomingMessageCache, roundEntry.peer_entries);
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
          wait(websocket, info, machine, incomingMessageCache, roundEntry.peer_entries);
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
          wait(websocket, info, machine, incomingMessageCache, roundEntry.peer_entries);
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
          wait(websocket, info, machine, incomingMessageCache, roundEntry.peer_entries);
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
          wait(websocket, info, machine, incomingMessageCache, roundEntry.peer_entries);
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

    websocket.on("sessionMessage", (incoming: Message) => {
      incomingMessageCache.add(incoming);
    });

    machine.on("transitionEnter", onTransition);

    // Start the state machine running
    await machine.next();
  });
}
