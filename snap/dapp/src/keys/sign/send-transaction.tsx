import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { Alert, Button, Stack, Typography } from "@mui/material";

import { sessionSelector } from "../../store/session";
import { saveMessageProof } from "../../store/proofs";
import { setSnackbar } from "../../store/snackbars";
import { SignTransaction } from "../../types";
import { fromHexString } from "../../utils";
import PublicAddress from "../../components/public-address";
import SignTransactionView from './transaction-view';

import { utils, BigNumber } from 'ethers';

import { prepareTransaction} from "@metamask/mpc-snap-wasm";

export default function SendTransaction() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { group, signCandidate, signProof } = useSelector(sessionSelector);
  const { address, creator, signingType } = signCandidate;
  const { label } = group;

  const navigateKeys = () => navigate(`/keys/${address}`);

  const { transaction, digest } = signCandidate.value as SignTransaction;

  /*
  const r = BigNumber.from(Uint8Array.from(signProof.signature.r.scalar));
  const s = BigNumber.from(Uint8Array.from(signProof.signature.s.scalar));
  //const v = signProof.signature.recid;
  const v = signProof.signature.recid + (transaction.chainId * 2) + 35;

  console.log(signProof);
  console.log("r", r.toHexString());
  console.log("s", s.toHexString());
  console.log("v", v);

  const signedTransaction = {
    ...transaction,
    hash: digest,
    from: address,
    r: r.toHexString(),
    s: s.toHexString(),
    v: v,
  };
  */

  const sendTransaction = async () => {

    /*
    const gasPriceValue = BigNumber.from(transaction.gasPrice);
    const txParams = [
      transaction.nonce.toHexString(),
    ];

    const tx = utils.RLP.encode(txParams);
    console.log(tx);
    */

    /*
    const signature = {
      r: r.toHexString(),
      s: s.toHexString(),
      v: v,
    };

    const tx = utils.serializeTransaction(transaction, signature);
    console.log(tx);
    */

    const from = Array.from(fromHexString(address.substring(2)));
    const to = Array.from(fromHexString(transaction.to.substring(2)));

    const tx = await prepareTransaction(
      BigInt(transaction.nonce),
      BigInt(transaction.chainId),
      BigInt(1000), // FIXME
      from,
      to,
      signProof.signature,
    );

    console.log("tx", tx);

    const parsed = utils.parseTransaction(tx);
    console.log('parsed...', parsed);

    /*
    const result = (await ethereum.request({
      method: "eth_sendRawTransaction",
      params: [tx],
    })) as string;

    console.log('result', result);
    */
  }

  /*
  const saveProof = () => {
    try {
      dispatch(saveMessageProof([address, signProof]));
      navigate(`/keys/${address}`);
    } catch (e) {
      console.error(e);
      dispatch(
        setSnackbar({
          message: `Could not save message proof: ${e.message || ""}`,
          severity: "error",
        })
      );
    }
  };
  */

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


  /*
      <Button variant="contained" onClick={saveProof}>
        Save Proof
      </Button>
  */

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
