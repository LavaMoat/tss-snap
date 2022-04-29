import React from "react";

import { Stack, Typography } from "@mui/material";

import { SigningType } from './index';

import SnapConnect from "../../../snap-connect";

type SignConnectProps = {
  next: () => void;
  signingType: SigningType;
}

export default function Connect(props: SignConnectProps) {
  const { next, signingType } = props;

  const redirect = () => next();

  return (
    <Stack spacing={2} marginTop={2} padding={2}>
      <Stack>
        <Typography variant="body1" component="div">
          You have been invited to sign a {signingType}.
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          To approve the {signingType} first connect and join the session.
        </Typography>
      </Stack>
      <SnapConnect redirect={redirect} />
    </Stack>
  );
}
