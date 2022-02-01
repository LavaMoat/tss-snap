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
      if (messages.length > 0) {
        wait(websocket, info, machine, incomingMessageCache, messages);
      } else {
        // Prepare to sign partial but must allow the
        // transition function to return first!
        setTimeout(() => machine.next(), 0);
      }
      return true;
    };
  }

  return new Promise(async (resolve) => {
    const machine = new StateMachine<SignState, SignTransition>([]);
    machine.states = [
      {
        name: "SIGN_ROUND_0",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const index = keyShare.localKey.i;

          // Must share our party signup index
          // in order to initialize the state
          // machine with list of signing participants
          const indexMessage: Message = {
            sender: index,
            receiver: null,
            body: null,
          };
          wait(websocket, info, machine, incomingMessageCache, [indexMessage]);
          return true;
        },
      },
      {
        name: "SIGN_ROUND_1",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const incoming = transitionData as Message[];
          let participants = incoming.map((msg) => msg.sender);
          participants.push(keyShare.localKey.i);
          participants.sort();

          // Initialize the WASM state machine
          await worker.signInit(
            info.partySignup.number,
            participants,
            keyShare.localKey
          );

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
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const partial = await worker.signPartial(message);
          // Broadcast the partial signature
          // to other clients
          const partialMessage: Message = {
            sender: info.partySignup.number,
            receiver: null,
            body: partial,
          };
          wait(websocket, info, machine, incomingMessageCache, [
            partialMessage,
          ]);
          return true;
        },
      },
      {
        name: "SIGN_FINALIZE",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const incoming = transitionData as Message[];
          const partials = incoming.map((msg) => msg.body);
          const signResult = await worker.signCreate(partials);
          websocket.removeAllListeners("sessionMessage");
          machine.removeAllListeners("transitionEnter");
          resolve(signResult);
          return null;
        },
      },
    ];

    websocket.on("sessionMessage", (incoming: Message) => {
      incomingMessageCache.add(incoming);
    });

    machine.on("transitionEnter", onTransition);

    // Start the state machine running
    await machine.next();
  });
}
