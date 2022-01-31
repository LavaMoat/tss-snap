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

  function makeStandardTransition(
    machine: StateMachine<SignState, SignTransition>
  ) {
    return async function standardTransition(
      previousState: SignState,
      transitionData: SignTransition
    ): Promise<SignState | null> {
      const incoming = transitionData as Message[];
      for (const message of incoming) {
        await worker.signHandleIncoming(message);
      }
      const messages = await worker.signProceed();
      wait(websocket, info, machine, incomingMessageCache, messages);
      return true;
    };
  }

  return new Promise(async (resolve) => {
    const machine = new StateMachine<SignState, SignTransition>([]);
    machine.states = [
      {
        name: "SIGN_ROUND_1",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const messages = await worker.signProceed();
          wait(websocket, info, machine, incomingMessageCache, messages);
          return true;
        },
      },
      {
        name: "SIGN_ROUND_2",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_3",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_4",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_5",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_6",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_7",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_8",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_9",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          console.log("Handle sign round 9");
          return null;
        },
      },
      /*
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
    ];

    websocket.on("sessionMessage", (incoming: Message) => {
      incomingMessageCache.add(incoming);
    });

    machine.on("transitionEnter", onTransition);

    // Start the state machine running
    await machine.next();
  });
}
