import React from "react";

import { Alert, Link, Stack, Typography } from "@mui/material";

import SnapConnect from "./snap-connect";

export default function Connect() {
  return (
    <>
      <Stack spacing={2}>
        <Typography variant="h3" component="div" gutterBottom>
          Connect
        </Typography>
        <Typography variant="body1" component="div" gutterBottom>
          Read more&nbsp;
          <Link href="#/about">
          about threshold signatures
          </Link>
          &nbsp;or get the&nbsp;
          <Link href="https://github.com/LavaMoat/tss-snap">
          source code
          </Link>
          &nbsp;on github.
        </Typography>
        <Alert severity="warning">
          This is BETA software, you use it at your own risk.

          It is strongly recommended that you export your key shares to password protected keystores and back them up to multiple storage devices.
        </Alert>
        <SnapConnect redirect="/keys" />
      </Stack>
    </>
  );
}
