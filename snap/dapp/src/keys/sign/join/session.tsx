import React, { useEffect, useContext, useState } from "react";
import { useDispatch } from "react-redux";

import { Stack, Typography, CircularProgress } from "@mui/material";

import {
  SessionKind,
} from "@metamask/mpc-client";

import { WebSocketContext } from "../../../websocket-provider";
import { joinGroupSession } from '../../../group-session';

import { StepProps } from "./index";

export default function Compute(props: StepProps) {
  const { address, next, signingType } = props;
  const [label, setLabel] = useState("...");

  const [progressMessage, setProgressMessage] = useState(
    "Connecting to session..."
  );
  const { groupId, sessionId } = props;
  const dispatch = useDispatch();
  const websocket = useContext(WebSocketContext);

  /*
  useEffect(() => {
    // Delay a little so we don't get flicker when the connection
    // is very fast.
    setTimeout(async () => {
      const [group, session] = await joinGroupSession(
        SessionKind.KEYGEN,
        groupId,
        sessionId,
        websocket,
        dispatch
      );

      setLabel(group.label);

      setProgressMessage("Waiting for other participants...");

      // All parties signed up to key generation
      websocket.once("sessionSignup", async (sessionId: string) => {
        if (sessionId === session.uuid) {
          console.log("Invited participant got session ready...");
          //next();
        } else {
          throw new Error("Session id is for another session");
        }
      });

    }, 1000);
  }, []);
  */

  return (
    <Stack spacing={2} marginTop={2} padding={2}>
      <Stack>
        <Typography variant="h4" component="div">
          {label}
        </Typography>
      </Stack>

      <Stack>
        <Typography variant="body1" component="div">
          You have been invited to sign a {signingType}.
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          Approve the {signingType} by signing it.
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={2}>
        <CircularProgress size={20} />
        <Typography variant="body2" component="div" color="text.secondary">
          {progressMessage}
        </Typography>
      </Stack>
    </Stack>
  );
}
