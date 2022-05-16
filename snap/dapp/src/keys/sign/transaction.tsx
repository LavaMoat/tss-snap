import React from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";

import { Breadcrumbs, Link, Stack, Typography } from "@mui/material";

import NotFound from "../../not-found";
import PublicAddress from "../../components/public-address";
import { keysSelector } from "../../store/keys";

export default function SignTransaction() {
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
  const { label } = share;
  return (
    <>
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link underline="hover" color="inherit" href="#/keys">
              Keys
            </Link>
            <Link underline="hover" color="inherit" href={"#/keys/" + address}>
              {label}
            </Link>
            <Typography color="text.primary">Sign Transaction</Typography>
          </Breadcrumbs>
          <Typography variant="h3" component="div">
            {label}
          </Typography>
        </Stack>
        <PublicAddress address={address} abbreviate />
      </Stack>
    </>
  );
}
