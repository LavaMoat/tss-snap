import React, { useState } from "react";

import { Button, Stack, TextField } from "@mui/material";

import { utils, UnsignedTransaction, BigNumber } from "ethers";

import { fromHexString } from "../../../utils";
import { SignTransaction } from "../../../types";


import { prepareUnsignedTransaction} from "@metamask/mpc-snap-wasm";

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

    const gasLimit = "0x30d400";
    const data = "0x00";
    // NOTE: Must do some conversion so that
    // NOTE: RLP encoding works as expected, otherwise
    // NOTE: some values are not detected as BytesLike
    const chainId = BigNumber.from(chain);
    const nonce = BigNumber.from(transactionCount);
    const gasPriceValue = BigNumber.from(gasPrice);
    //const maxFeePerGas = "";
    //const maxPriorityFeePerGas = "";

    const transaction: UnsignedTransaction = {
      nonce: nonce.toNumber(),
      to,
      value,
      gasPrice,
      gasLimit,
      data,
      //maxFeePerGas,
      //maxPriorityFeePerGas,
      chainId: chainId.toNumber(),
    };

    /*
    const txParams = [
      nonce.toHexString(),
      gasPriceValue.toHexString(),
      transaction.gasLimit,
      transaction.to,
      (transaction.value as BigNumber).toHexString(),
      transaction.data,
      chainId.toHexString(),
      "0x00",
      "0x00",
    ];

    const rawTransaction = utils.RLP.encode(txParams);
    const transactionHash = utils.keccak256(rawTransaction);

    // NOTE: Handle the quirky 0x prefixed string
    // NOTE: keccak256 implementation
    const digest = fromHexString(transactionHash.substring(2));
    */

    const digest = await prepareUnsignedTransaction(
      BigInt(transaction.nonce),
      BigInt(transaction.chainId),
      BigNumber.from(transaction.value).toBigInt(),
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
