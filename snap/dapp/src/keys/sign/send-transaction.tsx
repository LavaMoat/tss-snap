import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import { AppDispatch } from "../../store";
import { sessionSelector } from "../../store/session";
import { saveTransactionReceipt } from "../../store/receipts";
import { setSnackbar } from "../../store/snackbars";
import { SignTransaction } from "../../types";
import { fromHexString } from "../../utils";
import PublicAddress from "../../components/public-address";
import SignTransactionView from './transaction-view';

import { BigNumber, UnsignedTransaction, providers, utils } from 'ethers';

import { prepareSignedTransaction} from "@lavamoat/mpc-snap-wasm";

type MakeTransactionProps = {
  transaction: UnsignedTransaction;
  digest: Uint8Array;
  sendTransaction: () => Promise<void>;
  transactionHash?: string;
}

function MakeTransaction(props: MakeTransactionProps) {
  const {
    transaction,
    digest,
    sendTransaction,
    transactionHash,
  } = props;

  if (transactionHash == null) {
    return <>
      <SignTransactionView isSigned={true}
        transaction={transaction}
        digest={digest} />
      <Button
        variant="contained"
        onClick={sendTransaction}>Make Transaction</Button>
    </>;
  } else {
    return <>
      <Typography variant="body1" component="div">
        Transaction hash: {transactionHash}
      </Typography>
      <Stack direction="row" spacing={2}>
        <CircularProgress size={20} />
        <Typography variant="body2" component="div" color="text.secondary">
          Waiting for transaction confirmation...
        </Typography>
      </Stack>
      <SignTransactionView isSigned={true}
        transaction={transaction}
        digest={digest} />
    </>;
  }
}

export default function SendTransaction() {
  const dispatch: AppDispatch = useDispatch();
  const navigate = useNavigate();

  const [transactionHash, setTransactionHash] = useState<string>(null);
  const { group, signCandidate, signProof } = useSelector(sessionSelector);
  const { address, creator, signingType } = signCandidate;
  const { label } = group;

  const navigateKeys = () => navigate(`/keys/${address}`);
  const { transaction, digest } = signCandidate.value as SignTransaction;

  const sendTransaction = async () => {
    const nonce = BigNumber.from(transaction.nonce);
    const from = Array.from(fromHexString(address.substring(2)));
    const to = Array.from(fromHexString(transaction.to.substring(2)));
    const value = BigNumber.from(transaction.value);
    const tx = await prepareSignedTransaction(
      nonce.toHexString(),
      BigInt(transaction.chainId),
      value.toHexString(),
      BigNumber.from(transaction.gasLimit).toHexString(),
      BigNumber.from(transaction.maxFeePerGas).toHexString(),
      BigNumber.from(transaction.maxPriorityFeePerGas).toHexString(),
      from,
      to,
      signProof.signature,
    );

    try {
      const txHash = (await ethereum.request({
        method: "eth_sendRawTransaction",
        params: [tx],
      })) as string;

      setTransactionHash(txHash);

      // TODO: switch to InfuraProvider for chains other than Ganache
      const provider = new providers.JsonRpcProvider();
      const txReceipt = await provider.waitForTransaction(txHash);
      const signTxReceipt = {
        ...signProof,
        amount: utils.formatEther(transaction.value),
        tx: signCandidate.value as SignTransaction,
        // NOTE: we want the settled timestamp not the signed timestamp
        timestamp: Date.now(),
        value: txReceipt,
      };

      await dispatch(saveTransactionReceipt([address, signTxReceipt]));
      dispatch(
        setSnackbar({
          message: `Transaction completed`,
          severity: "success",
        })
      );
      navigate(`/keys/${address}`);
    } catch (e) {
      console.error(e);
      dispatch(
        setSnackbar({
          message: e.message || "Failed to make transaction",
          severity: "error",
        })
      );
    }
  }

  const heading = creator ? null : (
    <Stack>
      <Typography variant="h4" component="div">
        {label}
      </Typography>
      <Stack direction="row" alignItems="center">
        <PublicAddress address={address} abbreviate />
      </Stack>
    </Stack>
  );

  const action = creator
    ? (<MakeTransaction
        transaction={transaction}
        digest={digest}
        sendTransaction={sendTransaction}
        transactionHash={transactionHash}
      />)
    : (<>
        <Typography variant="body1" component="div">
          The creator of the transaction will submit it to the blockchain.
        </Typography>
        <Button variant="contained" onClick={navigateKeys}>Done</Button>
      </>);


  return (
    <Stack padding={1} spacing={2} marginTop={2}>
      {heading}
      <Alert severity="success">The {signingType} was signed!</Alert>
      {action}
    </Stack>
  );
}
