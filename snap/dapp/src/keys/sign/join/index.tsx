import React, { useState } from "react";
import { useParams } from "react-router-dom";

import {
  Box,
  Stack,
  Typography,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";

import NotFound from "../../../not-found";
import { SigningType } from "../../../types";
import { ListenerCleanup } from "../../../websocket-provider";

import Connect from "./connect";
import Approve from "./approve";
import Compute from "../compute";
//import Save from "../save";

import Signer from "../signer";

const steps = ["Connect", "Approve", "Compute", "Save Proof"];

export type StepProps = {
  next: () => void;
  address: string;
  signingType: SigningType;
  groupId: string;
  sessionId: string;
};

const getStepComponent = (activeStep: number, props: StepProps) => {
  const stepComponents = [
    <Connect key={0} {...props} />,
    <Approve key={1} {...props} />,
    <Compute key={2} {...props} />,
    //<Save key={3} {...props} />,
  ];
  return stepComponents[activeStep];
};

function BadSigningType() {
  return (
    <Typography variant="h3" component="div">
      Signing type is invalid, must be message or transaction.
    </Typography>
  );
}

function CreateStepper() {
  const { address, signingType, groupId, sessionId } = useParams();

  if (
    signingType !== SigningType.MESSAGE &&
    signingType !== SigningType.TRANSACTION
  ) {
    return <BadSigningType />;
  }

  if (!groupId || !sessionId) {
    return <NotFound />;
  }

  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Stepper activeStep={activeStep}>
        {steps.map((label) => {
          const stepProps: { completed?: boolean } = {};
          return (
            <Step key={label} {...stepProps}>
              <StepLabel>{label}</StepLabel>
            </Step>
          );
        })}
      </Stepper>
      {getStepComponent(activeStep, {
        next: handleNext,
        address,
        signingType,
        groupId,
        sessionId,
      })}
    </Box>
  );
}

export default function JoinSignSession() {
  const { signingType, groupId, sessionId } = useParams();

  if (
    signingType !== SigningType.MESSAGE &&
    signingType !== SigningType.TRANSACTION
  ) {
    return <BadSigningType />;
  }

  if (!groupId || !sessionId) {
    return <NotFound />;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="div" gutterBottom>
        Sign a {signingType}
      </Typography>
      <CreateStepper />
      <Signer />
      <ListenerCleanup />
    </Stack>
  );
}
