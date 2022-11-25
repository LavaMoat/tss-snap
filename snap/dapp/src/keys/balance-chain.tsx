import React, { useState, useEffect } from 'react';
import { useParams } from "react-router-dom";

import {
  Box,
  Stack,
  //Typography,
} from "@mui/material";

import { utils } from "ethers";

import { getChainName } from "../utils";
import SelectedChain from './selected-chain';

export default function BalanceChain() {
  const { address } = useParams();
  const [balance, setBalance] = useState("0x0");
  const [chain, setChain] = useState<string>(null);

  useEffect(() => {
    ethereum.on("chainChanged", handleChainChanged);

    function handleChainChanged(chainId: string) {
      setChain(chainId);
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

  if (!chain) {
    return null;
  }

  const chainName = getChainName(chain);

  return (
    <Stack direction="row" alignItems="center">
      <Box sx={{ flexGrow: 1 }}>
        Balance: {utils.formatEther(balance)} ETH
      </Box>
      <SelectedChain chainName={chainName} />
    </Stack>
  );
}
