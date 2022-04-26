import React from 'react';

import {
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";

type SignStepperProps = {
  steps: string[];
  activeStep: number;
}

export default function SignStepper(props: SignStepperProps) {
  const { steps, activeStep } = props;
  return (
    <>
      <Stepper activeStep={activeStep}>
        {steps.map((label) => {
          return (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          );
        })}
      </Stepper>
    </>
  );
}
