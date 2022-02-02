import { StateMachine, TransitionHandler } from "./machine";
import { KeyShare, SessionInfo, Phase } from ".";
import { MessageCache, Message } from "./message-cache";
import { waitFor } from "./wait-for";
import { WebSocketClient } from "../websocket";

export type KeygenTransition = Message[];
export type KeygenState = boolean;

export async function generateKeyShare(
  websocket: WebSocketClient,
  worker: any,
  onTransition: TransitionHandler<KeygenState, KeygenTransition>,
  info: SessionInfo
): Promise<KeyShare> {
  const incomingMessageCache = new MessageCache(info.parameters.parties - 1);
  const wait = waitFor<KeygenState, KeygenTransition>();

  // Initialize the WASM state machine
  await worker.keygenInit(info.parameters, info.partySignup);

  function makeStandardTransition(
    machine: StateMachine<KeygenState, KeygenTransition>
  ) {
    return async function standardTransition(
      previousState: KeygenState,
      transitionData: KeygenTransition
    ): Promise<KeygenState | null> {
      const incoming = transitionData as Message[];
      for (const message of incoming) {
        await worker.keygenHandleIncoming(message);
      }
      const messages = await worker.keygenProceed();
      wait(websocket, info, machine, incomingMessageCache, messages);
      return true;
    };
  }

  return new Promise(async (resolve) => {
    const machine = new StateMachine<KeygenState, KeygenTransition>([]);
    machine.states = [
      {
        name: "KEYGEN_ROUND_1",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const messages = await worker.keygenProceed();
          wait(websocket, info, machine, incomingMessageCache, messages);
          return true;
        },
      },
      {
        name: "KEYGEN_ROUND_2",
        transition: makeStandardTransition(machine),
      },
      {
        name: "KEYGEN_ROUND_3",
        transition: makeStandardTransition(machine),
      },
      {
        name: "KEYGEN_ROUND_4",
        transition: makeStandardTransition(machine),
      },
      {
        name: "KEYGEN_ROUND_5",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const incoming = transitionData as Message[];
          for (const message of incoming) {
            await worker.keygenHandleIncoming(message);
          }
          await worker.keygenProceed();
          const keyShare: KeyShare = await worker.keygenCreate();
          websocket.removeAllListeners("sessionMessage");
          machine.removeAllListeners("transitionEnter");
          resolve(keyShare);
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
