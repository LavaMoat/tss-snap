import React, { useState, useContext } from 'react';
import { useParams } from "react-router-dom";
import {useSelector, useDispatch} from 'react-redux';

import {
  Breadcrumbs,
  Link,
  Stack,
  Typography,
} from "@mui/material";

import {
  keccak256,
} from "@metamask/mpc-snap-wasm";

import {
  SessionKind,
} from "@metamask/mpc-client";

import {encode} from '../../../utils';

import { WebSocketContext, ListenerCleanup } from "../../../websocket-provider";
import { createGroupSession } from '../../../group-session';

import NotFound from '../../../not-found';
import PublicAddress from "../../../components/public-address";
import {keysSelector, KeyShareGroup} from '../../../store/keys';
import SignStepper from '../../../components/stepper';
import KeysLoader from '../../loader';

import CreateMessage from './create-message';
import InvitePeople from './invite-people';

const steps = [
  "Create message",
  "Invite people",
  "Compute",
  "Save Proof"
];

const getStepComponent = (activeStep: number, props: SignMessageProps) => {
  const stepComponents = [
    <CreateMessage key={0} {...props} />,
    <InvitePeople key={1} {...props} />,
  ];
  return stepComponents[activeStep];
};

export type SignMessageProps = {
  share: KeyShareGroup;
  onShareChange: (partyNumber: number) => void;
  selectedParty: number;
  message: string;
  messageHash: Uint8Array,
  onMessage: (message: string) => void;
};

export default function SignMessage() {
  const dispatch = useDispatch();
  const websocket = useContext(WebSocketContext);

  const { address } = useParams();
  const { keyShares, loaded } = useSelector(keysSelector);
  const [activeStep, setActiveStep] = useState(0);
  const [message, setMessage] = useState("");
  const [messageHash, setMessageHash] = useState(new Uint8Array());
  const [selectedParty, setSelectedParty] = useState(null);

  if (!loaded) {
    return <KeysLoader />;
  }

  const keyShare = keyShares.find((item) => {
    const [keyAddress] = item;
    return keyAddress === address;
  });

  if (!keyShare) {
    return <NotFound />;
  }

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const share: KeyShareGroup = keyShare[1];
  const { label, threshold, parties, items } = share;

  if (items.length === 0) {
    throw new Error("Invalid key share, no items found");
  }

  const onShareChange = (n: number) => {
    setSelectedParty(n);
  }

  const onMessage = async (message: string) => {
    setMessage(message);
    const digest = await keccak256(Array.from(encode(message)));
    setMessageHash(digest);

    const formData = [label, { parties, threshold }];

    // Create the remote server group and session and store
    // the information in the redux state before proceeding to
    // the next view
    await createGroupSession(
      SessionKind.SIGN,
      formData,
      websocket,
      dispatch
    );

    handleNext();
  }

  const stepProps = {
    next: handleNext,
    share,
    selectedParty: selectedParty || items[0],
    onShareChange,
    message,
    onMessage,
    messageHash,
  };

  return (
    <>
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link underline="hover" color="inherit" href="#/keys">
              Keys
            </Link>
            <Link underline="hover" color="inherit" href={"#/keys/" + address}>
              {label}
            </Link>
            <Typography color="text.primary">Sign Message</Typography>
          </Breadcrumbs>
          <Typography variant="h3" component="div">
            {label}
          </Typography>
        </Stack>
        <PublicAddress address={address} abbreviate />
        <SignStepper steps={steps} activeStep={activeStep} />
        {getStepComponent(activeStep, stepProps)}
        <ListenerCleanup />
      </Stack>
    </>
  );
}
