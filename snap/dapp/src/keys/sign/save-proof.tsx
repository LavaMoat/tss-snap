import React from "react";
import { useSelector } from "react-redux";

import { Alert, Button, Stack, Typography } from "@mui/material";

import { sessionSelector } from "../../store/session";
import PublicAddress from "../../components/public-address";

export default function SaveProof() {
  const { group, signCandidate, signProof } = useSelector(sessionSelector);
  const { address, creator, signingType } = signCandidate;
  const { label } = group;

  console.log("Save proof", signProof);

  const saveProof = () => {
    console.log("TODO: save proof", signProof);
  };

  const heading = creator ? null : (
    <Stack>
      <Typography variant="h4" component="div">
        {label}
      </Typography>
      <Stack direction="row" alignItems="center">
        <PublicAddress address={address} />
      </Stack>
    </Stack>
  );

  return (
    <Stack padding={1} spacing={2} marginTop={2}>
      {heading}
      <Alert severity="success">The {signingType} was signed!</Alert>
      <Button variant="contained" onClick={saveProof}>
        Save Proof
      </Button>
    </Stack>
  );
}
