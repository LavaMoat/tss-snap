import { useContext } from "react";
import { useSelector, useDispatch } from "react-redux";

import { sign } from "@metamask/mpc-client";

import { WebSocketContext } from "../../websocket-provider";
import { sessionSelector, setSignProof } from "../../store/session";
import { findKeyShare } from "../../store/keys";
import { setWorkerProgress } from "../../store/worker-progress";
import { WorkerContext } from "../../worker";

// Helper for signing messages that can be used in the views
// for creators and other participants that have been invited
// by the creator.
export default function Signer(): null {
  const dispatch = useDispatch();
  const websocket = useContext(WebSocketContext);
  const worker = useContext(WorkerContext);
  const { group, session, transport, signCandidate } =
    useSelector(sessionSelector);

  websocket.removeAllListeners("sessionLoad");

  websocket.once("sessionLoad", async (sessionId: string) => {
    if (sessionId === session.uuid) {
      const { stream, sink } = transport;
      const { address, value } = signCandidate;
      const { digest } = value;
      const { partySignup } = session;

      const namedKeyShare = await findKeyShare(address, partySignup.number);
      const { share: keyShare } = namedKeyShare;

      const totalRounds = 10;
      let currentRound = 1;

      const onTransition = (previousRound: string, current: string) => {
        let message = "";
        if (previousRound) {
          message = `Transition from ${previousRound} to ${current}`;
        } else {
          message = `Transition to ${current}`;
        }

        const workerInfo = { message, totalRounds, currentRound };
        dispatch(setWorkerProgress(workerInfo));
        currentRound++;
      };

      const { signature, address: signAddress } = await sign(
        websocket,
        worker,
        stream,
        sink,
        digest,
        keyShare,
        group,
        partySignup,
        onTransition
      );

      if (address !== signAddress) {
        throw new Error("Key share address and signature address do not match");
      }

      const signProof = {
        signature,
        address: signAddress,
        value,
        timestamp: Date.now(),
      };
      dispatch(setSignProof(signProof));
    } else {
      throw new Error("Got sessionLoad event for the wrong session");
    }
  });
  return null;
}
