import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { Alert, Button, Stack, Typography } from "@mui/material";

import { sessionSelector } from "../../store/session";
import { saveTransactionReceipt } from "../../store/receipts";
import { setSnackbar } from "../../store/snackbars";
import { SignTransaction } from "../../types";
import { fromHexString } from "../../utils";
import PublicAddress from "../../components/public-address";
import SignTransactionView from './transaction-view';

import { BigNumber, providers, utils } from 'ethers';

import { prepareSignedTransaction} from "@lavamoat/mpc-snap-wasm";

export default function SendTransaction() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [disabled, setDisabled] = useState(false);
  const { group, signCandidate, signProof } = useSelector(sessionSelector);
  const { address, creator, signingType } = signCandidate;
  const { label } = group;

  const navigateKeys = () => navigate(`/keys/${address}`);
  const { transaction, digest } = signCandidate.value as SignTransaction;

  const sendTransaction = async () => {
    setDisabled(true);
    const from = Array.from(fromHexString(address.substring(2)));
    const to = Array.from(fromHexString(transaction.to.substring(2)));
    const amount = BigNumber.from(transaction.value).toBigInt();
    const tx = await prepareSignedTransaction(
      BigInt(transaction.nonce),
      BigInt(transaction.chainId),
      amount,
      from,
      to,
      signProof.signature,
    );

    try {
      const txHash = (await ethereum.request({
        method: "eth_sendRawTransaction",
        params: [tx],
      })) as string;

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
      setDisabled(false);
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
        <PublicAddress address={address} />
      </Stack>
    </Stack>
  );

  const action = creator
    ? (<>
        <SignTransactionView isSigned={true} transaction={transaction} digest={digest} />
        <Button
          disabled={disabled}
          variant="contained"
          onClick={sendTransaction}>Make Transaction</Button>
      </>)
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
