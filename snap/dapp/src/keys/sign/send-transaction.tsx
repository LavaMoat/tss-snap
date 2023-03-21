import React, { useState, useContext } from "react";
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
import { ChainContext } from "../../chain-provider";
import PublicAddress from "../../components/public-address";
import SignTransactionView from './transaction-view';

import { Transaction, JsonRpcProvider, getNumber, toBeHex, formatEther} from 'ethers';

import { prepareSignedTransaction} from "@lavamoat/mpc-snap-wasm";

type MakeTransactionProps = {
  transaction: Transaction;
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
        onClick={sendTransaction}>Submit Transaction</Button>
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
  const chain = useContext(ChainContext);

  const [transactionHash, setTransactionHash] = useState<string>(null);
  const { group, signCandidate, signProof } = useSelector(sessionSelector);
  const { address, creator, signingType } = signCandidate;
  const { label } = group;

  const navigateKeys = () => navigate(`/keys/${address}`);
  const { transaction, digest } = signCandidate.value as SignTransaction;

  const sendTransaction = async () => {
    const nonce = BigInt(transaction.nonce);
    const from = Array.from(fromHexString(address.substring(2)));
    const to = Array.from(fromHexString(transaction.to.substring(2)));
    const value = BigInt(transaction.value);
    const tx = await prepareSignedTransaction(
      toBeHex(nonce),
      BigInt(transaction.chainId),
      toBeHex(value),
      toBeHex(BigInt(transaction.gasLimit)),
      toBeHex(BigInt(transaction.maxFeePerGas)),
      toBeHex(BigInt(transaction.maxPriorityFeePerGas)),
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

      // Switch to InfuraProvider for chains other than Ganache
      const chainNumber = getNumber(chain);
      const isLocalChain = chainNumber == 1337;

      // FIXME:
      const provider = new JsonRpcProvider();
      //const provider = new BrowserProvider();

      /*
      const provider = isLocalChain
        ? new JsonRpcProvider()
        : new providers.InfuraProvider(
          chainNumber,
          process.env.INFURA_API_KEY,
        );
      */
      const txReceipt = await provider.waitForTransaction(txHash);
      const signTxReceipt = {
        ...signProof,
        amount: formatEther(transaction.value),
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
      const message = (e.data && e.data.message) || e.message;
      dispatch(
        setSnackbar({
          message: message || "Failed to make transaction",
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
