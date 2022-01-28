import { StateMachine, TransitionHandler } from "./machine";
import { PartyKey, RoundEntry, SessionInfo, Phase } from ".";
import { PeerEntryCache, PeerEntry } from "./peer-state-gg2020";
import { waitFor } from "./wait-for-gg2020";
import { WebSocketClient } from "../websocket";

export type KeygenTransition = PeerEntry[];
export type KeygenState = boolean;

/*
interface Message {
  sender: number;
  receiver?: number;
}
*/

// Private key share for GG2020.
interface KeyShare {
  localKey: LocalKey;
  publicKey: number[];
  address: string;
}

// Opaque type for the private key share.
interface LocalKey {}

export async function generateKeyShare(
  websocket: WebSocketClient,
  worker: any,
  onTransition: TransitionHandler<KeygenState, KeygenTransition>,
  info: SessionInfo
): Promise<PartyKey> {
  const peerCache = new PeerEntryCache(info.parameters.parties - 1);
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
          const incoming = transitionData as PeerEntry[];
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
          const incoming = transitionData as PeerEntry[];
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
          const incoming = transitionData as PeerEntry[];

          console.log("Keygen round 4 got incoming", incoming);

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
          const incoming = transitionData as PeerEntry[];
          for (const message of incoming) {
            await worker.keygenHandleIncoming(message);
          }
          await worker.keygenProceed();
          console.log("KEYGEN ROUND 5 PROCEEDED");

          const keyShare: KeyShare = await worker.keygenCreate();
          console.log("Got keygen key share", keyShare);
          websocket.removeAllListeners("sessionMessage");
          machine.removeAllListeners("transitionEnter");
          //resolve(keyShare);
          return null;
        },
      },
    ]);

    websocket.on("sessionMessage", async (peerEntry: PeerEntry) => {
      peerCache.add(peerEntry);
    });

    machine.on("transitionEnter", onTransition);

    // Start the state machine running
    await machine.next();
  });
}
