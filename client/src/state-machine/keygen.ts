import { StateMachine, TransitionHandler } from "./machine";
import {
  Parameters,
  PartySignup,
  PartySignupInfo,
  PartyKey,
  RoundEntry,
} from "../machine-common";
import { makePeerState, PeerEntryHandler, PeerEntry } from "./peer-state";
import { WebSocketClient } from "../websocket";

// Type to pass through the client state machine during key generation.
interface KeygenRoundEntry {
  parameters: Parameters;
  partySignup: PartySignup;
  roundEntry: RoundEntry;
}

export type KeygenTransition = string[];
export type KeygenState = KeygenRoundEntry;

export interface KeygenInfo {
  groupId: string;
  sessionId: string;
  parameters: Parameters;
  partySignup: PartySignup;
}

export function generateKeyShare(
  websocket: WebSocketClient,
  worker: any,
  onTransition: TransitionHandler<KeygenState, KeygenTransition>,
  info: KeygenInfo
): Promise<PartyKey> {
  return new Promise((resolve, reject) => {
    const peerEntryHandler = makePeerState(info.parameters.parties - 1);

    const machine = new StateMachine<KeygenState, KeygenTransition>(
      [
        {
          name: "KEYGEN_ROUND_1",
          transition: async (
            previousState: KeygenState,
            transitionData: KeygenTransition
          ): Promise<KeygenState | null> => {
            const { parameters, partySignup } = info;

            // Create the round 1 key entry
            const roundEntry = await worker.keygenRound1(
              parameters,
              partySignup
            );

            // Send the round 1 entry to the server
            websocket.notify({
              method: "peer_relay",
              params: [info.groupId, info.sessionId, roundEntry.peer_entries],
            });

            console.log("RETURNING FROM ROUND 1");
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
            const { parameters, partySignup } = keygenRoundEntry;
            const answer = transitionData as string[];

            console.log("Round 2 got answer", answer);

            /*
            // Get round 2 entry using round 1 commitments
            const roundEntry = await worker.keygenRound2(
              parameters,
              partySignup,
              keygenRoundEntry.roundEntry,
              answer
            );

            // Send the round 2 entry to the server
            websocket.notify({
              method: "peer_relay",
              params: [info.groupId, info.sessionId, roundEntry.peer_entries],
            });
            */

            //return { parameters, partySignup, roundEntry };
            return null;
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

            // Send the round 3 entry to the server
            websocket.notify({
              method: "peer_relay",
              params: [info.groupId, info.sessionId, roundEntry.peer_entries],
            });

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

            // Send the round 4 entry to the server
            websocket.notify({
              method: "peer_relay",
              params: [info.groupId, info.sessionId, roundEntry.peer_entries],
            });

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

            // Send the round 5  entry to the server
            websocket.notify({
              method: "peer_relay",
              params: [info.groupId, info.sessionId, roundEntry.peer_entries],
            });

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
            resolve(key);

            return null;
          },
        },
      ],
      { onTransition }
    );

    websocket.on("peer_relay", async (peerEntry: PeerEntry) => {
      const answer = peerEntryHandler(peerEntry);
      // Got all the p2p answers
      if (answer) {
        console.log("Got all p2p answers", answer);
        await machine.next(answer);
      }
    });

    machine.next();
  });
}
