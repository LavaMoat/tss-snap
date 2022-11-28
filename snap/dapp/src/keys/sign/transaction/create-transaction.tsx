import React from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";

import { Stack, Paper } from "@mui/material";

import NotFound from "../../../not-found";
import { keysSelector } from "../../../store/keys";

import BalanceChain from "../../balance-chain";

import ChooseKeyShare from "../choose-key-share";

import { SignTransactionProps } from "./index";
import TransactionForm from "./transaction-form";

export default function CreateTransaction(props: SignTransactionProps) {
  const { address } = useParams();
  const { keyShares } = useSelector(keysSelector);

  const keyShare = keyShares.find((item) => {
    const [keyAddress] = item;
    return keyAddress === address;
  });

  if (!keyShare) {
    return <NotFound />;
  }

  return (
    <>
      <Stack spacing={2}>
        <Paper variant="outlined">
          <Stack padding={2}>
            <BalanceChain />
          </Stack>
        </Paper>

        <ChooseKeyShare {...props} />

        <TransactionForm
          from={address}
          onTransaction={props.onTransaction}
        />
      </Stack>
    </>
  );
}
