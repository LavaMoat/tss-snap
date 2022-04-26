import React, { useState } from 'react';
import { useParams } from "react-router-dom";
import {useSelector} from 'react-redux';

import {
  Breadcrumbs,
  Link,
  Stack,
  Typography,
} from "@mui/material";

import NotFound from '../../not-found';
import PublicAddress from "../../components/public-address";
import {keysSelector, KeyShareGroup} from '../../store/keys';
import SignStepper from '../../components/stepper';
import CreateMessage from './create-message';

const steps = [
  "Create message",
  "Invite participants",
  "Compute",
  "Save Proof"
];

const getStepComponent = (activeStep: number, props: SignMessageProps) => {
  const stepComponents = [
    <CreateMessage key={0} {...props} />,
  ];
  return stepComponents[activeStep];
};

export type SignMessageProps = {
  share: KeyShareGroup;
  onShareChange: (partyNumber: number) => void;
  selectedParty: number;
  message: string;
  onMessage: (message: string) => void;
};

export default function SignMessage() {
  const { address } = useParams();
  const { keyShares } = useSelector(keysSelector);
  const [activeStep, setActiveStep] = useState(0);
  const [message, setMessage] = useState("");

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
  const { label, items } = share;

  if (items.length === 0) {
    throw new Error("Invalid key share, no items found");
  }

  const [selectedParty, setSelectedParty] = useState(items[0]);

  const onShareChange = (n: number) => {
    setSelectedParty(n);
  }

  const onMessage = (message: string) => {
    setMessage(message);
    handleNext();
  }

  const stepProps = {
    next: handleNext,
    share,
    selectedParty,
    onShareChange,
    message,
    onMessage,
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
      </Stack>
    </>
  );
}
