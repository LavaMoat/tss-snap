import React from "react";
import { useSelector } from "react-redux";

import { Box, Chip, Stack, Typography, CircularProgress } from "@mui/material";

import { sessionSelector } from "../../store/session";
import PublicAddress from "../../components/public-address";

type ComputeProps = {
  next: () => void;
};

function WaitForApproval() {
  return (
    <Stack direction="row" alignItems="center" spacing={2}>
      <CircularProgress size={20} />
      <Typography variant="body2" component="div" color="text.secondary">
        Waiting for approval...
      </Typography>
    </Stack>
  );
}

export default function Compute(props: ComputeProps) {
  const { next } = props;
  const { group, signCandidate } = useSelector(sessionSelector);
  const { address, creator, selectedParty } = signCandidate;
  const { label } = group;

  //<Stack>
  //<Typography variant="body1" component="div">
  //Computing the key share
  //</Typography>
  //<Typography variant="body2" component="div" color="text.secondary">
  //Please be patient, this may take a while...
  //</Typography>
  //</Stack>
  //
  const heading = creator ? null : (
    <Stack>
      <Typography variant="h4" component="div">
        {label}
      </Typography>
      <Stack direction="row" alignItems="center">
        <PublicAddress address={address} />
        <Box sx={{ flexGrow: 1 }} />
        <Chip label={`Using key share for party #${selectedParty}`} />
      </Stack>
    </Stack>
  );

  return (
    <Stack padding={1} spacing={2} marginTop={2}>
      {heading}
      <WaitForApproval />
    </Stack>
  );
}
