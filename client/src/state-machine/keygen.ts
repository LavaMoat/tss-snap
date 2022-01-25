import { StateMachine, TransitionHandler } from "./machine";
import { PartyKey, RoundEntry, SessionInfo } from ".";
import { PeerEntryCache, PeerEntry } from "./peer-state";
import { waitFor } from "./wait-for";
import { WebSocketClient } from "../websocket";

export type KeygenTransition = string[];
export type KeygenState = RoundEntry;

export function generateKeyShare(
  websocket: WebSocketClient,
  worker: any,
  onTransition: TransitionHandler<KeygenState, KeygenTransition>,
  info: SessionInfo
): Promise<PartyKey> {
  const peerCache = new PeerEntryCache(info.parameters.parties - 1);
  const wait = waitFor<KeygenState, KeygenTransition>();

  return new Promise(async (resolve) => {
    const machine = new StateMachine<KeygenState, KeygenTransition>([

      {
        name: "KEYGEN_ROUND_1",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          await worker.initKeygen(
            info.parameters,
            info.partySignup
          );
          const roundEntry = await worker.keygenRound1();

          console.log("First round got entry: ", roundEntry);

          //wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },

      /*
      {
        name: "KEYGEN_ROUND_1",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const roundEntry = await worker.keygenRound1(
            info.parameters,
            info.partySignup
          );
          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return roundEntry;
        },
      },
      {
        name: "KEYGEN_ROUND_2",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.keygenRound2(
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
        name: "KEYGEN_ROUND_3",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.keygenRound3(
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
        name: "KEYGEN_ROUND_4",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.keygenRound4(
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
        name: "KEYGEN_ROUND_5",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const roundEntry = await worker.keygenRound5(
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
        name: "KEYGEN_FINALIZE",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const previousRoundEntry = previousState as RoundEntry;
          const answer = transitionData as string[];
          const keyShare: PartyKey = await worker.createKey(
            info.parameters,
            info.partySignup,
            previousRoundEntry,
            answer
          );

          websocket.removeAllListeners("peerRelay");
          machine.removeAllListeners("transitionEnter");
          resolve(keyShare);
          return null;
        },
      },
      */
    ]);

    websocket.on("peerRelay", async (peerEntry: PeerEntry) => {
      peerCache.add(peerEntry);
    });

    machine.on("transitionEnter", onTransition);

    // Start the state machine running
    await machine.next();
  });
}
