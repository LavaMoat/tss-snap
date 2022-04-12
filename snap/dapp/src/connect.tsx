import React from "react";

import {
  Stack,
  Typography,
} from "@mui/material";

import SnapConnect from './snap-connect';

export default function Connect() {

  // TODO: redirect to /keys instead later

  return (
    <>
      <Stack spacing={2}>
        <Typography variant="h3" component="div" gutterBottom>
          Connect
        </Typography>
        <SnapConnect redirect="/keys/create" />
      </Stack>
    </>
  );
}
