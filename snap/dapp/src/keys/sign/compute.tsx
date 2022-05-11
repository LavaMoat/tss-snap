import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Box, Chip, Stack, Typography, CircularProgress } from "@mui/material";

import { sessionSelector } from "../../store/session";
import {
  workerProgressSelector,
  clearWorkerProgress,
} from "../../store/worker-progress";
import PublicAddress from "../../components/public-address";
import WorkerProgress from "../worker-progress";

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
  const dispatch = useDispatch();
  const { next } = props;
  const { group, signCandidate, signProof } = useSelector(sessionSelector);
  const { progress } = useSelector(workerProgressSelector);
  const { address, creator, selectedParty, signingType } = signCandidate;
  const { label } = group;
  const { message } = progress;

  useEffect(() => {
    if (signProof !== null) {
      dispatch(clearWorkerProgress());
      next();
    }
  }, [signProof]);

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

  console.log("Got progress message", message);

  const indicator =
    message === "" ? (
      <WaitForApproval />
    ) : (
      <WorkerProgress title={`Signing a ${signingType}`} />
    );

  return (
    <Stack padding={1} spacing={2} marginTop={2}>
      {heading}
      {indicator}
    </Stack>
  );
}
