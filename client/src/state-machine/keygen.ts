import { StateMachine, TransitionHandler } from "./machine";
import { KeyShare, SessionInfo, Phase } from ".";
import { MessageCache, Message } from "./message-cache";
import { waitFor } from "./wait-for-gg2020";
import { WebSocketClient } from "../websocket";

export type KeygenTransition = Message[];
export type KeygenState = boolean;

export async function generateKeyShare(
  websocket: WebSocketClient,
  worker: any,
  onTransition: TransitionHandler<KeygenState, KeygenTransition>,
  info: SessionInfo
): Promise<KeyShare> {
  const peerCache = new MessageCache(info.parameters.parties - 1);
  const wait = waitFor<KeygenState, KeygenTransition>();

  // Initialize the WASM state machine
  await worker.keygenInit(info.parameters, info.partySignup);

  return new Promise(async (resolve) => {
    const machine = new StateMachine<KeygenState, KeygenTransition>([
      {
        name: "KEYGEN_ROUND_1",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const messages = await worker.keygenStart();
          wait(websocket, info, machine, peerCache, messages);
          return true;
        },
      },

      {
        name: "KEYGEN_ROUND_2",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const incoming = transitionData as Message[];
          for (const message of incoming) {
            await worker.keygenHandleIncoming(message);
          }

          const messages = await worker.keygenProceed();
          wait(websocket, info, machine, peerCache, messages);
          return true;
        },
      },

      {
        name: "KEYGEN_ROUND_3",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const incoming = transitionData as Message[];
          for (const message of incoming) {
            await worker.keygenHandleIncoming(message);
          }

          const messages = await worker.keygenProceed();
          wait(websocket, info, machine, peerCache, messages);
          return true;
        },
      },

      {
        name: "KEYGEN_ROUND_4",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const incoming = transitionData as Message[];
          for (const message of incoming) {
            await worker.keygenHandleIncoming(message);
          }
          const messages = await worker.keygenProceed();
          wait(websocket, info, machine, peerCache, messages);
          return true;
        },
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
          console.log("Got keygen key share", keyShare);
          websocket.removeAllListeners("sessionMessage");
          machine.removeAllListeners("transitionEnter");
          //resolve(keyShare);
          return null;
        },
      },
    ]);

    websocket.on("sessionMessage", async (peerEntry: Message) => {
      peerCache.add(peerEntry);
    });

    machine.on("transitionEnter", onTransition);

    // Start the state machine running
    await machine.next();
  });
}
