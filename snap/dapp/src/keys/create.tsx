import React, { useState, useContext } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Box,
  Stack,
  Button,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Slider,
  TextField,
  Paper,
  Link,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";

import { Parameters, SessionKind } from "@metamask/mpc-client";

import { setGroup, setSession, keysSelector } from "../store/keys";
import { copyToClipboard } from "../utils";
import { WebSocketContext } from "../websocket-provider";

type GroupFormData = [string, Parameters];

const steps = ["Set parameters", "Invite people", "Compute", "Save"];

type StepProps = {
  next: () => void;
};

function SetParameters(props: StepProps) {
  const { next } = props;
  const websocket = useContext(WebSocketContext);
  const dispatch = useDispatch();

  const maxParties = 8;

  const [name, setName] = useState("");
  const [parties, setParties] = useState(3);
  const [threshold, setThreshold] = useState(2);
  const [nameError, setNameError] = useState(false);

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setName(e.target.value);
  const onPartiesChange = (value: number) => setParties(value);
  const onThresholdChange = (value: number) => setThreshold(value);

  const marks = Array(maxParties)
    .fill(0)
    .map((_, index) => {
      return {
        label: (index + 1).toString(),
        value: index + 1,
      };
    });

  const thresholdMarks = Array(parties)
    .fill(0)
    .map((_, index) => {
      return {
        label: (index + 1).toString(),
        value: index + 1,
      };
    });

  const createGroup = async (data: GroupFormData) => {
    const [label, params] = data;
    const uuid = await websocket.rpc({
      method: "Group.create",
      params: data,
    });
    const group = { label, params, uuid };
    dispatch(setGroup(group));

    let session = await websocket.rpc({
      method: "Session.create",
      params: [uuid, SessionKind.KEYGEN],
    });

    const partyNumber = await websocket.rpc({
      method: "Session.signup",
      params: [
        uuid,
        session.uuid,
        SessionKind.KEYGEN,
      ],
    });

    session = {
      ...session,
      partySignup: { number: partyNumber, uuid: session.uuid },
    };
    dispatch(setSession(session));

    console.log("Created session", session);

    next();
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setNameError(false);

    if (name.trim() === "") {
      setNameError(true);
      setName("");
    } else {
      // NOTE: convert from the human-friendly threshold
      // NOTE: to the internal representation which requires
      // NOTE: t+1 to sign
      createGroup([name, { parties, threshold: threshold - 1 }]);
    }
  };

  return (
    <form id="parameters-form" onSubmit={onSubmit} noValidate>
      <Stack padding={2} spacing={2} marginTop={2}>
        <Stack padding={1}>
          <Stack marginBottom={1}>
            <Typography variant="body1" component="div">
              Choose a name for the key share.
            </Typography>
            <Typography variant="body2" component="div" color="text.secondary">
              The name will help you select the key share when you want to sign
              a transaction.
            </Typography>
          </Stack>

          <TextField
            label="Name"
            autoFocus
            autoComplete="off"
            onChange={onNameChange}
            value={name}
            error={nameError}
            variant="outlined"
            placeholder="Name of the key share"
          />
        </Stack>

        <Stack marginBottom={4} padding={1}>
          <Stack>
            <Typography variant="body1" component="div">
              Set the number of people who will have a share in the key.
            </Typography>
            <Typography variant="body2" component="div" color="text.secondary">
              To generate a key you will need to invite this many people to
              participate.
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
              To sign a transaction this many people must agree to generate a
              signature.
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

        <Box sx={{ display: "flex", flexDirection: "row", pt: 2 }}>
          <Box sx={{ flex: "1 1 auto" }} />
          <Button type="submit" form="parameters-form">
            Next
          </Button>
        </Box>
      </Stack>
    </form>
  );
}

type InviteProps = {
  onCopy: () => void;
};

function InviteCard(props: InviteProps) {
  const { onCopy } = props;
  const [copied, setCopied] = useState(false);
  const { group, session } = useSelector(keysSelector);
  const href = `${location.protocol}//${location.host}/#/keys/join/${group.uuid}/${session.uuid}`;

  console.log("Invite with url", href);

  const copy = async () => {
    await copyToClipboard(href);
    setCopied(true);
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
      <Snackbar
        open={copied}
        autoHideDuration={3000}
        onClose={() => setCopied(false)}
      >
        <Alert onClose={() => setCopied(false)} severity="success">
          Link copied to clipboard
        </Alert>
      </Snackbar>
    </>
  );
}

function InvitePeople() {
  const [showProgress, setShowProgress] = useState(false);
  const { group } = useSelector(keysSelector);

  const onCopy = () => setShowProgress(true);

  const Progress = () => (
    <Stack>
      <Stack direction="row" alignItems='center' spacing={2}>
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

const getStepComponent = (activeStep: number, props: StepProps) => {
  const stepComponents = [
    <SetParameters key={0} {...props} />,
    <InvitePeople key={1} {...props} />,
    null,
    null,
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
      <Typography variant="h3" component="div" gutterBottom>
        Create a key share
      </Typography>
      <CreateStepper />
    </Stack>
  );
}
