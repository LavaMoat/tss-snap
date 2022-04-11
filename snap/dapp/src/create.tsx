import React, {useState} from "react";

import { Box, Stack, Button, Typography, Stepper, Step, StepLabel, Slider } from "@mui/material";

const steps = [
  'Set parameters',
  'Invite people',
  'Connect to session',
  'Generate',
];

function SetParameters() {

  const maxParties = 8;

  const [parties, setParties] = useState(3);
  const [threshold, setThreshold] = useState(2);
  const [thresholdMax, setThresholdMax] = useState(3);

  const onPartiesChange = (value: number) => setParties(value);
  const onThresholdChange = (value: number) => setThreshold(value);

  const marks = (Array(maxParties).fill(0)).map((_, index) => {
    return {
      label: (index + 1).toString(),
      value: (index + 1),
    }
  });

  const thresholdMarks = (Array(parties).fill(0)).map((_, index) => {
    return {
      label: (index + 1).toString(),
      value: (index + 1),
    }
  });

  return (
    <Stack padding={2} spacing={2} marginTop={2}>

      <Stack marginBottom={4} padding={1}>
        <Stack>
          <Typography variant="body1" component="div">
            Set the number of people who will have a share in the key.
          </Typography>
          <Typography variant="body2" component="div" color="text.secondary">
            To generate a key you will need to invite this many people to participate.
          </Typography>
        </Stack>

        <Slider
          aria-label="Parties"
          defaultValue={3}
          valueLabelDisplay="auto"
          onChange={(e, value) => onPartiesChange(value as number)}
          step={1}
          value={parties}
          marks={marks}
          min={2}
          max={maxParties}
        />
      </Stack>

      <Stack marginBottom={4} padding={1}>
        <Stack>
          <Typography variant="body1" component="div">
            Set the threshold required to create a signature.
          </Typography>
          <Typography variant="body2" component="div" color="text.secondary">
            To sign a transaction this many people must agree to generate a signature.
          </Typography>
        </Stack>

        <Slider
          aria-label="Threshold"
          defaultValue={2}
          valueLabelDisplay="auto"
          onChange={(e, value) => onThresholdChange(value as number)}
          step={1}
          value={threshold}
          marks={thresholdMarks}
          min={2}
          max={parties}
        />
      </Stack>
    </Stack>
  );
}

const stepComponents = [
  <SetParameters />,
  null,
  null,
  null,
];

function HorizontalLinearStepper() {
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={activeStep}>
        {steps.map((label, index) => {
          const stepProps: { completed?: boolean } = {};
          const labelProps: {
            optional?: React.ReactNode;
          } = {};
          return (
            <Step key={label} {...stepProps}>
              <StepLabel {...labelProps}>{label}</StepLabel>
            </Step>
          );
        })}
      </Stepper>
      {activeStep === steps.length ? (
        <>
          <Typography sx={{ mt: 2, mb: 1 }}>
            All steps completed - you&apos;re finished
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
            <Box sx={{ flex: '1 1 auto' }} />
            <Button onClick={handleReset}>Reset</Button>
          </Box>
        </>
      ) : (
        <>
          {stepComponents[activeStep]}

          <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
            <Button
              color="inherit"
              disabled={activeStep === 0}
              onClick={handleBack}
              sx={{ mr: 1 }}
            >
              Back
            </Button>
            <Box sx={{ flex: '1 1 auto' }} />
            <Button onClick={handleNext}>
              {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}

      //<Typography variant="body1" component="div" gutterBottom>
        //To create a new key share.
      //</Typography>

      //<Button
        //variant="contained"
        //onClick={() => console.log("create key share")}
      //>
        //Create a new key share
      //</Button>

export default function Create() {
  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="div">
        Create a key share
      </Typography>

      <HorizontalLinearStepper />

    </Stack>
  );
}
