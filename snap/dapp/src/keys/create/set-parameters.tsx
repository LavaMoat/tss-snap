import React, { useState, useContext } from "react";
import { useDispatch } from "react-redux";

import {
  Stack,
  Button,
  Typography,
  Slider,
  TextField,
} from "@mui/material";

import {
  Parameters,
  SessionKind,
  WebSocketSink,
  WebSocketStream,
} from "@metamask/mpc-client";

import { setGroup, setSession, setTransport } from "../../store/keys";
import { WebSocketContext } from "../../websocket-provider";

import { StepProps } from "./index";

type GroupFormData = [string, Parameters];

export default function SetParameters(props: StepProps) {
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
      params: [uuid, session.uuid, SessionKind.KEYGEN],
    });

    session = {
      ...session,
      partySignup: { number: partyNumber, uuid: session.uuid },
    };
    dispatch(setSession(session));

    console.log("Created session", session);

    const stream = new WebSocketStream(
      websocket,
      uuid,
      session.uuid,
      SessionKind.KEYGEN
    );

    const sink = new WebSocketSink(
      websocket,
      group.params.parties - 1,
      session.uuid
    );

    dispatch(setTransport({ stream, sink }));

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
        <Button variant="contained" type="submit" form="parameters-form">
          Next
        </Button>
      </Stack>
    </form>
  );
}
