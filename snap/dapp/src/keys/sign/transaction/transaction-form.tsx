import React, { useState } from "react";

import { Button, Stack, TextField } from "@mui/material";

import { utils, UnsignedTransaction, BigNumber } from "ethers";

import { fromHexString } from "../../../utils";
import { SignTransaction } from "../../../types";


import { prepareUnsignedTransaction} from "@lavamoat/mpc-snap-wasm";

type TransactionFormProps = {
  chain: string;
  gasPrice: string;
  transactionCount: string;
  onTransaction: (tx: SignTransaction) => void;
};

export default function TransactionForm(props: TransactionFormProps) {
  const { chain, gasPrice, transactionCount } = props;
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState(false);

  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState(false);

  const onAddressChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress(e.target.value);

  const onAmountChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setAmount(e.target.value);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddressError(false);
    setAmountError(false);

    let to, value;
    try {
      to = utils.getAddress(address);
      try {
        value = utils.parseUnits(amount);
      } catch (e) {
        setAmountError(true);
        return;
      }
    } catch (e) {
      setAddressError(true);
      return;
    }

    const data = "0x00";
    const gasLimit = BigNumber.from(3_200_000);
    const maxFeePerGas = BigNumber.from(800_000_000);
    const maxPriorityFeePerGas = BigNumber.from(22_000_000);

    // NOTE: Must do some conversion so that
    // NOTE: RLP encoding works as expected, otherwise
    // NOTE: some values are not detected as BytesLike
    const chainId = BigNumber.from(chain);
    const nonce = BigNumber.from(transactionCount);

    // NOTE: This transaction is only used to store state
    // NOTE: for UI display purposes; building of transactions
    // NOTE: RLP encoding, hashing etc. is done in webassembly
    const transaction: UnsignedTransaction = {
      nonce: nonce.toNumber(),
      to,
      value,
      gasPrice,
      gasLimit,
      data,
      maxFeePerGas,
      maxPriorityFeePerGas,
      chainId: chainId.toNumber(),
    };

    // Call out to webassembly to prepare a transaction
    // and get the transaction hash
    const digest = await prepareUnsignedTransaction(
      nonce.toHexString(),
      BigInt(transaction.chainId),
      BigNumber.from(transaction.value).toHexString(),
      maxFeePerGas.toHexString(),
      maxPriorityFeePerGas.toHexString(),
      Array.from(fromHexString(address.substring(2))),
      Array.from(fromHexString(transaction.to.substring(2))),
    );

    props.onTransaction({
      transaction,
      digest: fromHexString(digest.substring(2)),
    });
  };

  /*
        <Stack marginBottom={1}>
          <Typography variant="body1" component="div">
            Enter the address to send to.
          </Typography>
          <Typography variant="body2" component="div" color="text.secondary">
            Should be a valid public address starting with 0x.
          </Typography>
        </Stack>
  */

  return (
    <form id="transaction" onSubmit={onSubmit} noValidate>
      <Stack spacing={2}>
        <TextField
          label="Address"
          autoFocus
          autoComplete="off"
          onChange={onAddressChange}
          value={address}
          error={addressError}
          variant="outlined"
          placeholder="Enter the address for the recipient"
        />

        <TextField
          label="Amount"
          autoComplete="off"
          onChange={onAmountChange}
          value={amount}
          error={amountError}
          variant="outlined"
          placeholder="Amount of ETH to send"
        />

        <Button variant="contained" type="submit" form="transaction">
          Next
        </Button>
      </Stack>
    </form>
  );
}
