import React, { useContext } from "react";
import { useSelector } from "react-redux";

import { sign } from "@metamask/mpc-client";

import { WebSocketContext, ListenerCleanup } from "../../websocket-provider";
import { sessionSelector } from "../../store/session";
import { WorkerContext } from "../../worker";

export default function Signer() {
  const websocket = useContext(WebSocketContext);
  const worker = useContext(WorkerContext);
  const { group, session, transport, signCandidate } =
    useSelector(sessionSelector);

  websocket.removeAllListeners("sessionLoad");

  websocket.once("sessionLoad", async (sessionId: string) => {
    console.log("sessionLoad", session);

    if (sessionId === session.uuid) {
      const { stream, sink } = transport;
      const { address, value } = signCandidate;
      const { digest } = value;
      const { partySignup } = session;

      console.log("Got session LOAD event", sessionId);
      console.log(address);
      console.log(websocket, worker, stream, sink);
      console.log(digest);
      console.log(group, session);
      console.log(partySignup);

      // TODO: find the key share

      /*
          const { signature: signResult, address: publicAddress } = await sign(
            websocket,
            worker,
            stream,
            sink,
            hash,
            keyShare,
            group,
            partySignup
          );
      */
    } else {
      throw new Error("Got sessionLoad event for the wrong session.");
    }
  });

  return <ListenerCleanup />;
}
