import React, { useContext } from "react";
import { useSelector, useDispatch } from "react-redux";

import { sign } from "@metamask/mpc-client";

import { WebSocketContext, ListenerCleanup } from "../../websocket-provider";
import { sessionSelector, setSignProof } from "../../store/session";
import { findKeyShare } from "../../store/keys";
import { WorkerContext } from "../../worker";

// Helper for signing messages that can be used in the views
// for creators and other participants that have been invited
// by the creator.
export default function Signer() {
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

      console.log("Got session LOAD event", sessionId);
      console.log(address);
      console.log(websocket, worker, stream, sink);
      console.log(digest);
      console.log(group, session);
      console.log(partySignup);
      console.log(keyShare);

      const { signature, address: signAddress } = await sign(
        websocket,
        worker,
        stream,
        sink,
        digest,
        keyShare,
        group,
        partySignup
      );

      if (address !== signAddress) {
        throw new Error("Key share address and signature address do not match");
      }

      console.log("Sign completed", signature, signAddress);
      const signProof = {
        signature,
        address: signAddress,
        value,
      };
      dispatch(setSignProof(signProof));
    } else {
      throw new Error("Got sessionLoad event for the wrong session.");
    }
  });

  return <ListenerCleanup />;
}
