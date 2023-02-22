import React, { useState, useEffect, useContext } from "react";

import { Button, Stack, TextField } from "@mui/material";

import { utils, UnsignedTransaction, BigNumber } from "ethers";

import { fromHexString } from "../../../utils";
import { SignTransaction } from "../../../types";
import { ChainContext } from "../../../chain-provider";


import { prepareUnsignedTransaction} from "@lavamoat/mpc-snap-wasm";

type TransactionFormProps = {
  from: string,
  onTransaction: (tx: SignTransaction) => void;
};

export default function TransactionForm(props: TransactionFormProps) {
  const chain = useContext(ChainContext);

  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState(false);

  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState(false);

  const [tip, setTip] = useState("220000000");
  const [tipError, setTipError] = useState(false);

  const [pendingBlock, setPendingBlock] = useState(null);
  const [gasPrice, setGasPrice] = useState("0x0");
  const [transactionCount, setTransactionCount] = useState("0x0");

  useEffect(() => {
    const getBlockInfo = async () => {

      const gasPrice = (await ethereum.request({
        method: "eth_gasPrice",
      })) as string;
      setGasPrice(gasPrice);

      const transactionCount = (await ethereum.request({
        method: "eth_getTransactionCount",
        params: [props.from, "latest"],
      })) as string;
      setTransactionCount(transactionCount);

      const pending = await ethereum.request({
        method: "eth_getBlockByNumber",
        params: ["pending", false]});
      setPendingBlock(pending);
    }
    getBlockInfo();
  }, []);

  const onAddressChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress(e.target.value);

  const onAmountChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setAmount(e.target.value);

  const onTipChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setTip(e.target.value);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setAddressError(false);
    setAmountError(false);
    setTipError(false);

    let to, value, priorityFee;
    try {
      to = utils.getAddress(address);
    } catch (e) {
      setAddressError(true);
      return;
    }
    try {
      value = utils.parseUnits(amount);
    } catch (e) {
      setAmountError(true);
      return;
    }
    try {
      priorityFee = utils.parseUnits(tip, "wei");
    } catch(e) {
      setTipError(true);
      return;
    }

    const baseFeePerGas = BigNumber.from(pendingBlock.baseFeePerGas);
    const data = "0x00";
    const maxPriorityFeePerGas = BigNumber.from(priorityFee);
    const maxFeePerGas = baseFeePerGas.add(maxPriorityFeePerGas);

    // NOTE: Must do some conversion so that
    // NOTE: RLP encoding works as expected, otherwise
    // NOTE: some values are not detected as BytesLike
    const chainId = BigNumber.from(chain);
    const nonce = BigNumber.from(transactionCount);

    const estimated = (await ethereum.request({
      method: "eth_estimateGas",
      params: [{ to }]
    })) as string;
    const gasLimit = BigNumber.from(estimated);

    // NOTE: This transaction is only used to store state
    // NOTE: for UI display purposes; building of transactions
    // NOTE: RLP encoding, hashing etc. is done in webassembly.
    //
    // NOTE: The reason for this is that using serializeTransaction()
    // NOTE: and parseTransaction() from ethers.utils was computing an
    // NOTE: incorrect `from` field which would cause the transaction to fail.
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
      gasLimit.toHexString(),
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

  if (pendingBlock == null) {
    return null;
  }

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
          label="Amount (ETH)"
          autoComplete="off"
          onChange={onAmountChange}
          value={amount}
          error={amountError}
          variant="outlined"
          placeholder="Amount of ETH to send"
        />

        <TextField
          label="Tip (WEI)"
          autoComplete="off"
          onChange={onTipChange}
          value={tip}
          error={tipError}
          variant="outlined"
          placeholder="Miner tip in WEI, bigger tips speed up the transaction"
        />

        <Button variant="contained" type="submit" form="transaction">
          Next
        </Button>
      </Stack>
    </form>
  );
}
