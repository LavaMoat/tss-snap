import React, { useState, useEffect, useContext } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Box,
  Stack,
  Button,
  Typography,
  Paper,
  Link,
  CircularProgress,
} from "@mui/material";

import { keysSelector } from "../../store/keys";
import { setSnackbar } from "../../store/snackbars";
import { copyToClipboard } from "../../utils";
import { WebSocketContext } from "../../websocket-provider";

import { StepProps } from "./index";

type InviteProps = {
  onCopy: () => void;
};

function InviteCard(props: InviteProps) {
  const dispatch = useDispatch();
  const { onCopy } = props;
  const { group, session } = useSelector(keysSelector);
  const href = `${location.protocol}//${location.host}/#/keys/join/${group.uuid}/${session.uuid}`;

  const copy = async () => {
    await copyToClipboard(href);

    dispatch(setSnackbar({
      message: 'Link copied to clipboard',
      severity: 'success'
    }));

    onCopy();
  };

  return (
    <>
      <Paper variant="outlined">
        <Box padding={4}>
          <details>
            <summary>
              <Typography
                variant="body2"
                component="span"
                color="text.secondary"
              >
                Send this link via email or private message to the people you
                wish to invite.
              </Typography>
            </summary>
            <Link href={href} onClick={(e) => e.preventDefault()}>
              {href}
            </Link>
          </details>
          <Button onClick={copy} sx={{ mt: 4 }}>
            Copy link to clipboard
          </Button>
        </Box>
      </Paper>
    </>
  );
}

export default function InvitePeople(props: StepProps) {
  const { next } = props;
  const [showProgress, setShowProgress] = useState(false);
  const { group, session } = useSelector(keysSelector);
  const websocket = useContext(WebSocketContext);

  useEffect(() => {
    // All parties signed up to key generation
    websocket.once("sessionSignup", async (sessionId: string) => {
      if (sessionId === session.uuid) {
        console.log("Owner got session ready...");
        next();
      } else {
        throw new Error("Session id is for another session");
      }
    });
  }, []);

  const onCopy = () => setShowProgress(true);

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
          You must invite {group.params.parties - 1} people to continue creating
          a key.
        </Typography>
      </Stack>
      <Stack>
        <InviteCard onCopy={onCopy} />
      </Stack>
      {showProgress ? <Progress /> : null}
    </Stack>
  );
}
