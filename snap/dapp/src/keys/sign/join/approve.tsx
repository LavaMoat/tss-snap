import React, { useEffect, useContext, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Stack, Typography, CircularProgress, Checkbox, FormControlLabel, Button } from "@mui/material";

import {
  SessionKind,
} from "@metamask/mpc-client";

import { WebSocketContext } from "../../../websocket-provider";
import { joinGroupSession } from '../../../group-session';
import {keysSelector, KeyShareGroup, setGroup, setSession} from '../../../store/keys';
import { SignValue }from "../../../types";

import NotFound from "../../../not-found";
import KeysLoader from '../../loader';
import SignMessageView from '../message-view';
import ChooseKeyShare from '../choose-key-share';
import PublicAddress from "../../../components/public-address";

import { StepProps, SigningType } from "./index";

type SessionConnectProps = {
  address: string;
  groupId: string;
  sessionId: string;
  keyShare: KeyShareGroup;
  signingType: SigningType;
  onApprove: () => void;
}

function SessionConnect(props: SessionConnectProps) {
  const { address, groupId, sessionId, keyShare, signingType, onApprove } = props;
  const [label, setLabel] = useState("...");
  const [value, setValue] = useState<SignValue>(null);
  const [selectedParty, setSelectedParty] = useState(null);
  const [approved, setApproved] = useState(false);
  const [progressVisible, setProgressVisible] = useState(true);
  const dispatch = useDispatch();
  const websocket = useContext(WebSocketContext);

  const onShareChange = (n: number) => {
    setSelectedParty(n);
  }

  useEffect(() => {
    // Delay a little so we don't get flicker when the connection
    // is very fast.
    setTimeout(async () => {
      const [group, session] = await joinGroupSession(
        SessionKind.SIGN,
        groupId,
        sessionId,
        websocket,
      );

      setValue(session.value);
      setLabel(group.label);

      dispatch(setGroup(group));
      dispatch(setSession(session));

      setProgressVisible(false);
    }, 1000);
  }, []);

  let preview = null;
  if (value) {
    preview = signingType === SigningType.Message ? (
      <SignMessageView
        message={value.message}
        digest={value.digest} />
    ) : (
      <p>TODO: show transaction preview</p>
    );
  }

  const approval = (
    <>
      <FormControlLabel
        control={<Checkbox />}
        onChange={() => setApproved(!approved)}
        label={`I approve this ${signingType}`}
      />
      <Button
        disabled={!approved}
        variant="contained"
        onClick={onApprove}>
        Next
      </Button>
    </>
  );

  return (
    <Stack spacing={2} marginTop={2} padding={1}>
      <Stack>
        <Typography variant="h4" component="div">
          {label}
        </Typography>
        <PublicAddress address={address} />
      </Stack>
      <Stack>
        <Typography variant="body1" component="div">
          You have been invited to sign a {signingType}.
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          Approve the {signingType} by signing it.
        </Typography>
      </Stack>
      {
        progressVisible && (
          <Stack direction="row" alignItems="center" spacing={2}>
            <CircularProgress size={20} />
            <Typography variant="body2" component="div" color="text.secondary">
              Connecting to session...
            </Typography>
          </Stack>
        )
      }
      <ChooseKeyShare
        keyShare={keyShare}
        onShareChange={onShareChange}
        selectedParty={selectedParty || keyShare.items[0]}
        />
      {
        value && preview
      }
      {
        value && approval
      }
    </Stack>
  );
}

export default function Approve(props: StepProps) {
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

  const keyShareGroup: KeyShareGroup = keyShare[1];
  return <SessionConnect
    address={address}
    groupId={groupId}
    sessionId={sessionId}
    keyShare={keyShareGroup}
    signingType={signingType}
    onApprove={next}
    />
}
