import React, {useEffect, useContext, useState} from 'react';
import {useDispatch} from 'react-redux';
import {useParams} from 'react-router-dom';

import {
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";

import { SessionKind } from "@metamask/mpc-client";

import {setGroup, setSession} from '../store/keys';
import SnapConnect from '../snap-connect';
import NotFound from '../not-found';
import {WebSocketContext} from '../websocket-provider';

export default function Participate() {
  const [progressMessage, setProgressMessage] = useState("Connecting to session...");
  const {groupId, sessionId} = useParams();
  const dispatch = useDispatch();
  const websocket = useContext(WebSocketContext);

  useEffect(() => {
    const joinGroupAndSession = async () => {
      console.log("joinGroupAndSession", groupId, sessionId);
      console.log("joinGroupAndSession", websocket);

      const group = await websocket.rpc({
        method: "Group.join",
        params: groupId,
      });
      dispatch(setGroup(group));

      let session = await websocket.rpc({
        method: "Session.join",
        params: [groupId, sessionId, SessionKind.KEYGEN],
      });

      const partyNumber = await websocket.rpc({
        method: "Session.signup",
        params: [
          groupId,
          sessionId,
          SessionKind.KEYGEN,
        ],
      });

      session = {
        ...session,
        partySignup: { number: partyNumber, uuid: session.uuid },
      };
      dispatch(setSession(session));

      console.log("Joined the session", session);

      setProgressMessage("Waiting for other participants...");
    }
    // Delay a little so we don't get flicker when the connection
    // is very fast.
    setTimeout(joinGroupAndSession, 1000);
  }, []);

  if (!groupId || !sessionId) {
    return <NotFound />
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="div" gutterBottom>
        Join a key
      </Typography>
      <Stack>
        <Typography variant="body1" component="div">
          You have been invited to own a share of a key.
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          By owning a share in the key you will be able to participate in collaborative signing of messages and transactions.
        </Typography>
      </Stack>
      <Stack direction="row" alignItems='center' spacing={2}>
        <CircularProgress size={20} />
        <Typography variant="body2" component="div" color="text.secondary">
          {progressMessage}
        </Typography>
      </Stack>
    </Stack>
  );
}
