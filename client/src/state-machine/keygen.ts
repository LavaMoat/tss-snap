import { StateMachine, TransitionHandler } from "./machine";
import {
  Parameters,
  PartySignup,
  PartySignupInfo,
  PartyKey,
  RoundEntry,
  SessionInfo,
} from ".";
import { PeerEntryCache, PeerEntry } from "./peer-state";
import { waitFor } from "./wait-for";
import { WebSocketClient } from "../websocket";

// Type to pass through the client state machine during key generation.
interface KeygenRoundEntry {
  parameters: Parameters;
  partySignup: PartySignup;
  roundEntry: RoundEntry;
}

export type KeygenTransition = string[];
export type KeygenState = KeygenRoundEntry;

export function generateKeyShare(
  websocket: WebSocketClient,
  worker: any,
  onTransition: TransitionHandler<KeygenState, KeygenTransition>,
  info: SessionInfo
): Promise<PartyKey> {
  const peerCache = new PeerEntryCache(info.parameters.parties - 1);
  const wait = waitFor<KeygenState, KeygenTransition>();

  return new Promise(async (resolve, reject) => {
    const machine = new StateMachine<KeygenState, KeygenTransition>([
      {
        name: "KEYGEN_ROUND_1",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const { parameters, partySignup } = info;

          const roundEntry = await worker.keygenRound1(parameters, partySignup);

          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return { parameters, partySignup, roundEntry };
        },
      },
      {
        name: "KEYGEN_ROUND_2",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const keygenRoundEntry = previousState as KeygenRoundEntry;
          const answer = transitionData as string[];
          const { parameters, partySignup } = keygenRoundEntry;

          const roundEntry = await worker.keygenRound2(
            parameters,
            partySignup,
            keygenRoundEntry.roundEntry,
            answer
          );

          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return { parameters, partySignup, roundEntry };
        },
      },
      {
        name: "KEYGEN_ROUND_3",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const keygenRoundEntry = previousState as KeygenRoundEntry;
          const { parameters, partySignup } = keygenRoundEntry;
          const answer = transitionData as string[];

          const roundEntry = await worker.keygenRound3(
            parameters,
            partySignup,
            keygenRoundEntry.roundEntry,
            answer
          );

          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return { parameters, partySignup, roundEntry };
        },
      },
      {
        name: "KEYGEN_ROUND_4",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const keygenRoundEntry = previousState as KeygenRoundEntry;
          const { parameters, partySignup } = keygenRoundEntry;
          const answer = transitionData as string[];

          const roundEntry = await worker.keygenRound4(
            parameters,
            partySignup,
            keygenRoundEntry.roundEntry,
            answer
          );

          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return { parameters, partySignup, roundEntry };
        },
      },
      {
        name: "KEYGEN_ROUND_5",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const keygenRoundEntry = previousState as KeygenRoundEntry;
          const { parameters, partySignup } = keygenRoundEntry;
          const answer = transitionData as string[];

          const roundEntry = await worker.keygenRound5(
            parameters,
            partySignup,
            keygenRoundEntry.roundEntry,
            answer
          );

          wait(websocket, info, machine, peerCache, roundEntry.peer_entries);
          return { parameters, partySignup, roundEntry };
        },
      },
      {
        name: "KEYGEN_FINALIZE",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const keygenRoundEntry = previousState as KeygenRoundEntry;
          const { parameters, partySignup } = keygenRoundEntry;
          const answer = transitionData as string[];

          const key: PartyKey = await worker.createKey(
            parameters,
            partySignup,
            keygenRoundEntry.roundEntry,
            answer
          );

          websocket.removeAllListeners("peer_relay");
          machine.removeAllListeners("transitionEnter");
          resolve(key);
          return null;
        },
      },
    ]);

    websocket.on("peer_relay", async (peerEntry: PeerEntry) => {
      peerCache.add(peerEntry);
    });

    machine.on("transitionEnter", onTransition);

    // Start the state machine running
    await machine.next();
  });
}
