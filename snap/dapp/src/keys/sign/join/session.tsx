import React, { useEffect, useContext, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Stack, Typography, CircularProgress } from "@mui/material";

import {
  SessionKind,
} from "@metamask/mpc-client";

import { WebSocketContext } from "../../../websocket-provider";
import { joinGroupSession } from '../../../group-session';
import {keysSelector, KeyShareGroup} from '../../../store/keys';
import { SignValue }from "../../../types";

import NotFound from "../../../not-found";
import KeysLoader from '../../loader';
import SignMessageView from '../message-view';

import { StepProps, SigningType } from "./index";

type SessionConnectProps = {
  address: string;
  groupId: string;
  sessionId: string;
  keyShare: KeyShareGroup;
  signingType: SigningType;
}

function SessionConnect(props: SessionConnectProps) {
  const { address, groupId, sessionId, keyShare, signingType } = props;
  const [label, setLabel] = useState("...");
  const [value, setValue] = useState<SignValue>(null);
  const [progressMessage, setProgressMessage] = useState(
    "Connecting to session..."
  );
  const dispatch = useDispatch();
  const websocket = useContext(WebSocketContext);

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

      setValue(session.value);
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

  let preview = null;
  if (value) {
    preview = signingType === SigningType.Message ? (
      <SignMessageView message={value.message} digest={value.digest} />
    ) : (
      <p>TODO: show transaction preview</p>
    );
  }

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
      {
        value && preview
      }
    </Stack>
  );
}

export default function Compute(props: StepProps) {
  const { address, next, signingType, groupId, sessionId } = props;
  const { keyShares, loaded } = useSelector(keysSelector);

  if (!loaded) {
    return <KeysLoader />;
  }

  const keyShare = keyShares.find((value: [string, KeyShareGroup]) => {
    const [keyAddress] = value;
    return address === keyAddress;
  });

  if (!keyShare) {
    return (
      <Stack marginTop={4}>
        <NotFound />
      </Stack>
    );
  }

  return <SessionConnect
    address={address}
    groupId={groupId}
    sessionId={sessionId}
    keyShare={keyShare}
    signingType={signingType}
    />
}
