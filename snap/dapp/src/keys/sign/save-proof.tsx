import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { Alert, Button, Stack, Typography } from "@mui/material";

import { sessionSelector } from "../../store/session";
import { saveMessageProof } from "../../store/proofs";
import { setSnackbar } from "../../store/snackbars";
import PublicAddress from "../../components/public-address";

export default function SaveProof() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { group, signCandidate, signProof } = useSelector(sessionSelector);
  const { address, creator, signingType } = signCandidate;
  const { label } = group;

  const saveProof = () => {
    try {
      dispatch(saveMessageProof([address, signProof]));
      navigate(`/keys/${address}`);
    } catch (e) {
      console.error(e);
      dispatch(
        setSnackbar({
          message: `Could not save message proof: ${e.message || ""}`,
          severity: "error",
        })
      );
    }
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
