import { PeerEntryCache, PeerEntry } from "./peer-state-gg2020";
import { StateMachine } from "./machine";
import { SessionInfo, Phase } from "./index";
import { WebSocketClient } from "../websocket";

export function waitFor<T, U>() {
  return async function waitForTransitionExitAndPeerAnswers(
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

    for (const message of peerEntries) {
      // FIXME: use correct phase
      await websocket.rpc({
        method: "Session.message",
        params: [info.groupId, info.sessionId, Phase.KEYGEN, message],
      });
    }

    //websocket.notify({
    //method: "Peer.relay",
    //params: [info.groupId, info.sessionId, peerEntries],
    //});
  };
}
