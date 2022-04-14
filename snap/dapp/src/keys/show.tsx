import React from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";

import { Box, Breadcrumbs, Chip, Link, Stack, Typography } from "@mui/material";

import { keysSelector } from "../store/keys";

import PublicAddress from "./public-address";
import NotFound from "../not-found";

export default function ShowKey() {
  const { address } = useParams();
  const { keyShares } = useSelector(keysSelector);

  const keyShare = keyShares.find((item) => {
    const [keyAddress] = item;
    return keyAddress === address;
  });

  if (!keyShare) {
    return <NotFound />;
  }

  const share = keyShare[1];
  const { label, threshold, parties, items } = share;

  return (
    <Stack spacing={2}>
      <Breadcrumbs aria-label="breadcrumb">
        <Link underline="hover" color="inherit" href="#/keys">
          Keys
        </Link>
        <Typography color="text.primary">{label}</Typography>
      </Breadcrumbs>

      <Typography variant="h3" component="div">
        {label}
      </Typography>
      <Box>
        <Chip
          label={`${items.length} share(s) in a ${threshold + 1} of ${parties}`}
        />
      </Box>
      <PublicAddress address={address} />
    </Stack>
  );
}
