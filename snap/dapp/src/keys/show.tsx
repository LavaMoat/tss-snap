import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";

import { utils } from "ethers";

import {
  Box,
  Breadcrumbs,
  Chip,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { keysSelector } from "../store/keys";
import { chains } from "../utils";

import PublicAddress from "./public-address";
import NotFound from "../not-found";

export default function ShowKey() {
  const { address } = useParams();
  const { keyShares } = useSelector(keysSelector);
  const [balance, setBalance] = useState("0x0");
  const [chain, setChain] = useState<string>(null);

  const keyShare = keyShares.find((item) => {
    const [keyAddress] = item;
    return keyAddress === address;
  });

  useEffect(() => {
    ethereum.on("chainChanged", handleChainChanged);

    function handleChainChanged() {
      window.location.reload();
    }

    const getBalance = async () => {
      const chainId = (await ethereum.request({
        method: "eth_chainId",
      })) as string;
      setChain(chainId);

      const result = (await ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      })) as string;
      setBalance(result);
    };
    getBalance();
  }, [address]);

  if (!keyShare) {
    return <NotFound />;
  }

  const share = keyShare[1];
  const { label, threshold, parties, items } = share;
  const sharesLabel = `${items.length} share(s) in a ${
    threshold + 1
  } of ${parties}`;

  if (!chain) {
    return null;
  }

  const chainName = chains[chain] as string;

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
      <Stack direction="row" spacing={1}>
        <Box>
          <Chip label={chainName} />
        </Box>
        <Box>
          <Chip label={sharesLabel} />
        </Box>
      </Stack>
      <PublicAddress address={address} />

      <Paper variant="outlined">
        <Stack alignItems="center" padding={2}>
          <Typography variant="h1" component="div">
            {utils.formatEther(balance)} ETH
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
