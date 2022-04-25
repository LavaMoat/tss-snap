import React, { useState } from "react";

import {
  Box,
  Breadcrumbs,
  Link,
  Stack,
  Button,
  Typography,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";

import SetParameters from "./set-parameters";
import InvitePeople from "./invite-people";
import Compute from "../compute";
import Save from "../save";

const steps = ["Set parameters", "Invite people", "Compute", "Save"];

export type StepProps = {
  next: () => void;
};

const getStepComponent = (activeStep: number, props: StepProps) => {
  const stepComponents = [
    <SetParameters key={0} {...props} />,
    <InvitePeople key={1} {...props} />,
    <Compute key={2} {...props} />,
    <Save key={3} {...props} />,
  ];
  return stepComponents[activeStep];
};

function CreateStepper() {
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleReset = () => {
    setActiveStep(0);
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
      {activeStep === steps.length ? (
        <>
          <Typography sx={{ mt: 2, mb: 1 }}>
            All steps completed - you&apos;re finished
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "row", pt: 2 }}>
            <Box sx={{ flex: "1 1 auto" }} />
            <Button onClick={handleReset}>Reset</Button>
          </Box>
        </>
      ) : (
        <>{getStepComponent(activeStep, { next: handleNext })}</>
      )}
    </Box>
  );
}

export default function Create() {
  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link underline="hover" color="inherit" href="#/keys">
            Keys
          </Link>
          <Typography color="text.primary">Create</Typography>
        </Breadcrumbs>
        <Typography variant="h3" component="div" gutterBottom>
          Create a key share
        </Typography>
      </Stack>

      <CreateStepper />
    </Stack>
  );
}
