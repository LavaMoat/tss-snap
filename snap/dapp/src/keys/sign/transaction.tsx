import React, {useState, useEffect} from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";

import { Box, Button, Chip, Breadcrumbs, Link, Stack, TextField, Typography } from "@mui/material";

import NotFound from "../../not-found";
import PublicAddress from "../../components/public-address";
import { keysSelector } from "../../store/keys";
import { sessionSelector } from "../../store/session";
import {chains} from '../../utils';

import SelectedChain from '../selected-chain';

import { utils, UnsignedTransaction, BigNumber } from 'ethers';

function TransactionForm({chain, gasPrice, transactionCount}) {
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState(false);

  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState(false);

  const onAddressChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress(e.target.value);

  const onAmountChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setAmount(e.target.value);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddressError(false);
    setAmountError(false);

    try {
      const to = utils.getAddress(address);
      try {
        const value = utils.parseUnits(amount);

        const gasLimit = "0x30d400";
        const data = "0x00";
        // NOTE: Must do some conversion so that
        // NOTE: RLP encoding works as expected, otherwise
        // NOTE: some values are not detected as BytesLike
        const chainId = BigNumber.from(chain)
        const nonce = BigNumber.from(transactionCount)
        //const maxFeePerGas = "";
        //const maxPriorityFeePerGas = "";

        const transaction: UnsignedTransaction = {
          nonce: nonce.toHexString(),
          to,
          value,
          gasPrice,
          gasLimit,
          data,
          //maxFeePerGas,
          //maxPriorityFeePerGas,
          chainId: chainId.toHexString(),
        };

        console.log("tx", transaction);

        const txParams = [
          transaction.nonce,
          transaction.gasPrice,
          transaction.gasLimit,
          transaction.to,
          transaction.value.toHexString(),
          transaction.data,
          transaction.chainId,
          '0x00',
          '0x00'
        ];

        console.log("params", txParams);

        const rawTransaction = utils.RLP.encode(txParams);
        console.log(rawTransaction.toString('hex'));

        const transactionHash = utils.keccak256(rawTransaction);
        console.log(transactionHash.toString('hex'));

      } catch (e) {
        setAmountError(true)
      }
    } catch (e) {
      setAddressError(true)
    }

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

export default function SignTransaction() {
  const { address } = useParams();
  const { keyShares } = useSelector(keysSelector);
  const { signProof } = useSelector(sessionSelector);
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
      setGasPrice(gasPrice)

      const transactionCount = (await ethereum.request({
        method: "eth_getTransactionCount",
        params: [address, "latest"],
      })) as string;
      setTransactionCount(transactionCount)

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

  const chainName = chains[chain] as string;

  const keyShareGroup: KeyShareGroup = keyShare[1];
  const { label, threshold, parties, items } = keyShareGroup;

  const selectedKeyShare =
    signProof === null ? (
      <>
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          label={`Using key share for party #${selectedParty || items[0]}`}
        />
      </>
    ) : null;

  return (
    <>
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link underline="hover" color="inherit" href="#/keys">
              Keys
            </Link>
            <Link underline="hover" color="inherit" href={"#/keys/" + address}>
              {label}
            </Link>
            <Typography color="text.primary">Sign Transaction</Typography>
          </Breadcrumbs>
          <Typography variant="h3" component="div">
            {label}
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center">
          <PublicAddress address={address} abbreviate />
          {selectedKeyShare}
        </Stack>

        <Stack
          direction="row"
          alignItems="center">

          <Box sx={{flexGrow: 1}}>{utils.formatEther(balance)} ETH</Box>
          <SelectedChain chainName={chainName} />

        </Stack>

        <TransactionForm
          chain={chain}
          gasPrice={gasPrice}
          transactionCount={transactionCount} />

      </Stack>
    </>
  );
}
