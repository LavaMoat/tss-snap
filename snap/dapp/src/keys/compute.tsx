import React, { useEffect, useContext } from "react";
import { useSelector } from "react-redux";

import { Stack, Typography } from "@mui/material";

import { SessionInfo } from "@metamask/mpc-client";

import { keysSelector } from "../store/keys";
import { WebSocketContext, ListenerCleanup } from "../websocket-provider";
import { WorkerContext } from "../worker";

import { StepProps } from "./create";

export default function Compute(props: StepProps) {
  const { next } = props;

  const worker = useContext(WorkerContext);
  const websocket = useContext(WebSocketContext);
  const { group, session, transport } = useSelector(keysSelector);

  useEffect(() => {
    console.log("TODO: start the computation, websocket", websocket);
    console.log("TODO: start the computation, group", group);
    console.log("TODO: start the computation, session", session);
    console.log("TODO: start the computation, transport", transport);

    const { stream, sink } = transport;
    const { uuid: groupId, params: parameters } = group;
    const { partySignup, uuid: sessionId } = session;

    const sessionInfo: SessionInfo = {
      groupId,
      sessionId,
      parameters,
      partySignup,
    };

    console.log("TODO: start the computation, sessionInfo", sessionInfo);
    console.log("TODO: start the computation, sessionInfo", worker);

    //const keyShare = await generateKeyShare(
    //worker,
    //stream,
    //sink,
    //sessionInfo
    //);
  }, []);

  return (
    <Stack padding={2} spacing={2} marginTop={2}>
      <Stack>
        <Typography variant="h4" component="div">
          {group.label}
        </Typography>
      </Stack>
      <Stack>
        <Typography variant="body1" component="div">
          Computing the key share
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          Please be patient, this may take a while...
        </Typography>
      </Stack>

      <ListenerCleanup />
    </Stack>
  );
}
