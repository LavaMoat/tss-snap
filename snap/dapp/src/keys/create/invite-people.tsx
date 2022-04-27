import React, { useState, useEffect, useContext } from "react";
import { useSelector } from "react-redux";

import {
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";

import { keysSelector } from "../../store/keys";
import { WebSocketContext } from "../../websocket-provider";

import { StepProps } from "./index";
import InviteCard, { inviteHref } from '../invite-card';

export default function InvitePeople(props: StepProps) {
  const { next } = props;
  const [showProgress, setShowProgress] = useState(false);
  const { group, session } = useSelector(keysSelector);
  const websocket = useContext(WebSocketContext);

  useEffect(() => {
    // All parties signed up to key generation
    websocket.once("sessionSignup", async (sessionId: string) => {
      if (sessionId === session.uuid) {
        next();
      } else {
        throw new Error("Session id is for another session");
      }
    });
  }, []);

  const onCopy = () => {
    if (!showProgress) {
      setShowProgress(true);
    }
  }

  const Progress = () => (
    <Stack>
      <Stack direction="row" alignItems="center" spacing={2}>
        <CircularProgress size={20} />
        <Typography variant="body2" component="div" color="text.secondary">
          Waiting for other participants...
        </Typography>
      </Stack>
    </Stack>
  );

  const totalInvites = group.params.parties - 1;
  const href = inviteHref("keys/join", group.uuid, session.uuid)
  const links = Array(totalInvites).fill("").map(() => href);

  return (
    <Stack padding={2} spacing={2} marginTop={2}>
      <Stack>
        <Typography variant="h4" component="div">
          {group.label}
        </Typography>
      </Stack>

      <Stack>
        <Typography variant="body1" component="div">
          Invite people to share the new key with you.
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          You must invite {totalInvites} people to continue creating
          a key.
        </Typography>
      </Stack>
      <InviteCard
        onCopy={onCopy}
        links={links} />
      {showProgress ? <Progress /> : null}
    </Stack>
  );
}
