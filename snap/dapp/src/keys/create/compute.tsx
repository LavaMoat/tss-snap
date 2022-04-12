import React, { useEffect, useContext } from "react";
import { useSelector } from "react-redux";

import {
  Stack,
  Typography,
} from "@mui/material";

import { keysSelector } from "../../store/keys";
import { WebSocketContext } from "../../websocket-provider";

import { StepProps } from './index';

export default function Compute(props: StepProps) {
  const {next} = props;
  const { group, session } = useSelector(keysSelector);
  const websocket = useContext(WebSocketContext);

  useEffect(() => {
    console.log("TODO: start the computation...");
  }, []);

  return (
    <Stack padding={2} spacing={2} marginTop={2}>
      <Stack>
        <Typography variant="h4" component="div">
          {group.label}
        </Typography>
      </Stack>
      <Stack>
        <Typography variant="body1" component="div">
          Computing the key share
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          Please be patient, this may take a while...
        </Typography>
      </Stack>
    </Stack>
  );
}
