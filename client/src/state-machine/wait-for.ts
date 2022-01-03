import { PeerEntryCache, PeerEntry } from "./peer-state";
import { StateMachine } from "./machine";
import { SessionInfo } from "./index";
import { WebSocketClient } from "../websocket";

export function waitFor<T, U>() {
  return function waitForTransitionExitAndPeerAnswers(
    websocket: WebSocketClient,
    info: SessionInfo,
    machine: StateMachine<T, U>,
    handler: PeerEntryCache,
    peerEntries: PeerEntry[]
  ) {
    let exitedTransition = false;
    let answer: U = null;

    async function waitEmit() {
      if (exitedTransition && answer) {
        await machine.next(answer);
      }
    }

    machine.once("transitionExit", () => {
      exitedTransition = true;
      waitEmit();
    });

    // It is possible for all the p2p answers to have
    // been received before this function is called so
    // we need to check that first.
    if (handler.isReady()) {
      answer = handler.take() as unknown as U;
      waitEmit();
    } else {
      handler.once("ready", () => {
        answer = handler.take() as unknown as U;
        waitEmit();
      });
    }

    websocket.notify({
      method: "peer_relay",
      params: [info.groupId, info.sessionId, peerEntries],
    });
  };
}
