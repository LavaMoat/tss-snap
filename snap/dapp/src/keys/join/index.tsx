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

import NotFound from "../../not-found";
import { ListenerCleanup } from "../../websocket-provider";

import Connect from "./connect";
import Session from "./session";
import Compute from "../compute";
import Save from "../save";

const steps = ["Connect", "Join session", "Compute", "Save"];

export type StepProps = {
  next: () => void;
  groupId: string;
  sessionId: string;
};

const getStepComponent = (activeStep: number, props: StepProps) => {
  const stepComponents = [
    <Connect key={0} {...props} />,
    <Session key={1} {...props} />,
    <Compute key={2} {...props} />,
    <Save key={3} {...props} />,
  ];
  return stepComponents[activeStep];
};

function CreateStepper() {
  const { groupId, sessionId } = useParams();

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
        groupId,
        sessionId,
      })}
    </Box>
  );
}

export default function Create() {
  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="div" gutterBottom>
        Join a key
      </Typography>
      <CreateStepper />
      <ListenerCleanup />
    </Stack>
  );
}
