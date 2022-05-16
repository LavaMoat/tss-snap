import React from "react";

import { Alert, Stack, Typography } from "@mui/material";

import SnapConnect from "./snap-connect";

export default function Connect() {
  return (
    <>
      <Stack spacing={2}>
        <Typography variant="h3" component="div" gutterBottom>
          Connect
        </Typography>
        <Alert severity="warning">
          This is BETA software, you use it at your own risk; at the very least
          avoid Mainnet for your transactions.
        </Alert>
        <SnapConnect redirect="/keys" />
      </Stack>
    </>
  );
}
