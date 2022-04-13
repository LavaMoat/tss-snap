import React from "react";

import { Stack, Typography } from "@mui/material";

import SnapConnect from "../../snap-connect";

import { StepProps } from "./index";

export default function Connect(props: StepProps) {
  const { next } = props;

  //const redirect = `/keys/participate/${groupId}/${sessionId}`;

  const redirect = () => {
    console.log("Connected....");
    next();
  };

  return (
    <Stack spacing={2} marginTop={2} padding={2}>
      <Stack>
        <Typography variant="body1" component="div">
          You have been invited to join a key.
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          By owning a share in the key you will be able to participate in
          collaborative signing of messages and transactions.
        </Typography>
      </Stack>
      <SnapConnect redirect={redirect} />
    </Stack>
  );
}
