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
interface KeygenRoundEntry<T> {
  parameters: Parameters;
  partySignup: PartySignup;
  roundEntry: T;
}

export type KeygenTransition = PartySignupInfo | string[];
export type KeygenState = KeygenRoundEntry<RoundEntry>;

export function generateKeyShare(
  websocket: WebSocketClient,
  worker: any,
  onTransition: TransitionHandler<KeygenState, KeygenTransition>,
  parameters: Parameters,
  partySignup: PartySignup
): Promise<PartyKey> {
  return new Promise((resolve, reject) => {
    let peerEntryHandler: PeerEntryHandler = null;

    websocket.on("peer_relay", async (peerEntry: PeerEntry) => {
      const answer = peerEntryHandler(peerEntry);
      // Got all the p2p answers
      if (answer) {
        await machine.next(answer);
      }
    });

    const machine = new StateMachine<KeygenState, KeygenTransition>(
      [
        {
          name: "KEYGEN_ROUND_1",
          transition: async (
            previousState: KeygenState,
            transitionData: KeygenTransition
          ): Promise<KeygenState | null> => {
            const partySignupInfo = transitionData as PartySignupInfo;
            const { parameters, partySignup } = partySignupInfo;

            peerEntryHandler = makePeerState(parameters.parties - 1);

            // Create the round 1 key entry
            const roundEntry = await worker.keygenRound1(
              parameters,
              partySignup
            );

            // Send the round 1 entry to the server
            websocket.rpc({
              method: "peer_relay",
              params: roundEntry.peer_entries,
            });

            return { parameters, partySignup, roundEntry };
          },
        },
        {
          name: "KEYGEN_ROUND_2",
          transition: async (
            previousState: KeygenState,
            transitionData: KeygenTransition
          ): Promise<KeygenState | null> => {
            const keygenRoundEntry =
              previousState as KeygenRoundEntry<RoundEntry>;
            const { parameters, partySignup } = keygenRoundEntry;
            const answer = transitionData as string[];

            // Get round 2 entry using round 1 commitments
            const roundEntry = await worker.keygenRound2(
              parameters,
              partySignup,
              keygenRoundEntry.roundEntry,
              answer
            );

            // Send the round 2 entry to the server
            websocket.rpc({
              method: "peer_relay",
              params: roundEntry.peer_entries,
            });

            return { parameters, partySignup, roundEntry };
          },
        },
        {
          name: "KEYGEN_ROUND_3",
          transition: async (
            previousState: KeygenState,
            transitionData: KeygenTransition
          ): Promise<KeygenState | null> => {
            const keygenRoundEntry =
              previousState as KeygenRoundEntry<RoundEntry>;
            const { parameters, partySignup } = keygenRoundEntry;
            const answer = transitionData as string[];

            const roundEntry = await worker.keygenRound3(
              parameters,
              partySignup,
              keygenRoundEntry.roundEntry,
              answer
            );

            // Send the round 3 entry to the server
            websocket.rpc({
              method: "peer_relay",
              params: roundEntry.peer_entries,
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
            const keygenRoundEntry =
              previousState as KeygenRoundEntry<RoundEntry>;
            const { parameters, partySignup } = keygenRoundEntry;
            const answer = transitionData as string[];

            const roundEntry = await worker.keygenRound4(
              parameters,
              partySignup,
              keygenRoundEntry.roundEntry,
              answer
            );

            // Send the round 4 entry to the server
            websocket.rpc({
              method: "peer_relay",
              params: roundEntry.peer_entries,
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
            const keygenRoundEntry =
              previousState as KeygenRoundEntry<RoundEntry>;
            const { parameters, partySignup } = keygenRoundEntry;
            const answer = transitionData as string[];

            const roundEntry = await worker.keygenRound5(
              parameters,
              partySignup,
              keygenRoundEntry.roundEntry,
              answer
            );

            // Send the round 5  entry to the server
            websocket.rpc({
              method: "peer_relay",
              params: roundEntry.peer_entries,
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
            const keygenRoundEntry =
              previousState as KeygenRoundEntry<RoundEntry>;
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

    machine.next({ parameters, partySignup });
  });
}
