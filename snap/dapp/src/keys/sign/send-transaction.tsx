import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { Alert, Button, Stack, Typography } from "@mui/material";

import { sessionSelector } from "../../store/session";
//import { saveMessageProof } from "../../store/proofs";
import { setSnackbar } from "../../store/snackbars";
import { SignTransaction } from "../../types";
import { fromHexString } from "../../utils";
import PublicAddress from "../../components/public-address";
import SignTransactionView from './transaction-view';

import { BigNumber, providers } from 'ethers';

import { prepareSignedTransaction} from "@metamask/mpc-snap-wasm";

export default function SendTransaction() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { group, signCandidate, signProof } = useSelector(sessionSelector);
  const { address, creator, signingType } = signCandidate;
  const { label } = group;

  const navigateKeys = () => navigate(`/keys/${address}`);

  const { transaction, digest } = signCandidate.value as SignTransaction;

  const sendTransaction = async () => {
    const from = Array.from(fromHexString(address.substring(2)));
    const to = Array.from(fromHexString(transaction.to.substring(2)));
    const tx = await prepareSignedTransaction(
      BigInt(transaction.nonce),
      BigInt(transaction.chainId),
      BigNumber.from(transaction.value).toBigInt(),
      from,
      to,
      signProof.signature,
    );

    /*
    console.log("tx", tx);
    const parsed = utils.parseTransaction(tx);
    console.log('parsed...', parsed);
    */

    try {
      const txHash = (await ethereum.request({
        method: "eth_sendRawTransaction",
        params: [tx],
      })) as string;

      console.log('tx hash', txHash);
      console.log("Waiting for transaction...");

      const provider = new providers.JsonRpcProvider();
      const txReceipt = await provider.waitForTransaction(txHash);
      console.log('txReceipt', txReceipt);

      // FIXME: handle the result and navigate

    } catch (e) {
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
        <SignTransactionView transaction={transaction} digest={digest} />
        <Button variant="contained" onClick={sendTransaction}>Make Transaction</Button>
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
