import React, { useState, useEffect, useContext } from 'react';
import { useParams } from "react-router-dom";

import {
  Box,
  Stack,
  //Typography,
} from "@mui/material";

import { utils } from "ethers";

import { getChainName } from "../utils";
import { ChainContext } from '../chain-provider';
import SelectedChain from './selected-chain';

export default function BalanceChain() {
  const { address } = useParams();
  const [balance, setBalance] = useState("0x0");
  const chain = useContext(ChainContext);

  useEffect(() => {
    const getBalance = async () => {
      const result = (await ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      })) as string;
      setBalance(result);
    };
    getBalance();
  }, [address]);

  console.log(chain);

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
