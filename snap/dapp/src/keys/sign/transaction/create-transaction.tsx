import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";

import { Box, Stack } from "@mui/material";

import NotFound from "../../../not-found";
import { keysSelector, KeyShareGroup } from "../../../store/keys";
//import { sessionSelector } from "../../../store/session";
import { getChainName } from "../../../utils";

import SelectedChain from "../../selected-chain";

import ChooseKeyShare from "../choose-key-share";

import { SignTransactionProps } from "./index";
import TransactionForm from "./transaction-form";

import { utils } from "ethers";

export default function CreateTransaction(props: SignTransactionProps) {
  const { address } = useParams();
  const { keyShares } = useSelector(keysSelector);
  //const { signProof } = useSelector(sessionSelector);
  const [selectedParty, setSelectedParty] = useState(null);

  const [balance, setBalance] = useState("0x0");
  const [gasPrice, setGasPrice] = useState("0x0");
  const [transactionCount, setTransactionCount] = useState("0x0");
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

      const gasPrice = (await ethereum.request({
        method: "eth_gasPrice",
      })) as string;
      setGasPrice(gasPrice);

      const transactionCount = (await ethereum.request({
        method: "eth_getTransactionCount",
        params: [address, "latest"],
      })) as string;
      setTransactionCount(transactionCount);

      const result = (await ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      })) as string;
      setBalance(result);
    };
    getBalance();
  }, [address]);

  const keyShare = keyShares.find((item) => {
    const [keyAddress] = item;
    return keyAddress === address;
  });

  if (!keyShare) {
    return <NotFound />;
  }

  if (!chain) {
    return null;
  }

  const chainName = getChainName(chain);

  //console.log(chain);
  //console.log(BigNumber.from(chain).toHexString());
  //console.log(chainName);

  const keyShareGroup: KeyShareGroup = keyShare[1];
  //const { threshold, parties, items } = keyShareGroup;

  return (
    <>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center">
          <Box sx={{ flexGrow: 1 }}>
            Balance: {utils.formatEther(balance)} ETH
          </Box>
          <SelectedChain chainName={chainName} />
        </Stack>

        <ChooseKeyShare {...props} />

        <TransactionForm
          chain={chain}
          gasPrice={gasPrice}
          transactionCount={transactionCount}
          onTransaction={props.onTransaction}
        />
      </Stack>
    </>
  );
}
