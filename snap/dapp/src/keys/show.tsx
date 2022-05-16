import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";

import { utils } from "ethers";

import {
  Box,
  Breadcrumbs,
  ButtonGroup,
  Button,
  Chip,
  Link,
  Paper,
  Stack,
  Typography,
  List,
  ListSubheader,
  ListItem,
  ListItemText,
} from "@mui/material";

import { keysSelector } from "../store/keys";
import {
  setDialogVisible,
  CONFIRM_DELETE_KEY_SHARE,
  EXPORT_KEY_STORE,
} from "../store/dialogs";
import { chains } from "../utils";

import PublicAddress from "../components/public-address";
import NotFound from "../not-found";
import KeysLoader from "./loader";
import MessageProofs from "./message-proofs";

export default function ShowKey() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { address } = useParams();
  const { keyShares, loaded } = useSelector(keysSelector);
  const [balance, setBalance] = useState("0x0");
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

      const result = (await ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      })) as string;
      setBalance(result);
    };
    getBalance();
  }, [address]);

  if (!loaded) {
    return <KeysLoader />;
  }

  const keyShare = keyShares.find((item) => {
    const [keyAddress] = item;
    return keyAddress === address;
  });

  if (!keyShare) {
    return <NotFound />;
  }

  const signMessage = () => {
    navigate(`/keys/${address}/sign/message`);
  };

  const signTransaction = () => {
    navigate(`/keys/${address}/sign/transaction`);
  };

  const onDeleteKeyShare = async (
    address: string,
    number: number,
    length: number
  ) => {
    dispatch(
      setDialogVisible([
        CONFIRM_DELETE_KEY_SHARE,
        true,
        [address, number, length],
      ])
    );
  };

  const onExportKeyShare = async (
    address: string,
    number: number,
    length: number
  ) => {
    dispatch(
      setDialogVisible([EXPORT_KEY_STORE, true, [address, number, length]])
    );
  };

  const share = keyShare[1];
  const { label, threshold, parties, items } = share;
  const sharesLabel = `${items.length} share(s) in a ${
    threshold + 1
  } of ${parties}`;

  if (!chain) {
    return null;
  }

  const chainName = chains[chain] as string;
  return (
    <>
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link underline="hover" color="inherit" href="#/keys">
              Keys
            </Link>
            <Typography color="text.primary">{label}</Typography>
          </Breadcrumbs>

          <Typography variant="h3" component="div">
            {label}
          </Typography>
        </Stack>
        <Stack direction="row">
          <Stack direction="row" spacing={1}>
            <Box>
              <Chip label={chainName} color="secondary" />
            </Box>
            <Box>
              <Chip label={sharesLabel} />
            </Box>
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          <ButtonGroup variant="contained">
            <Button onClick={signMessage}>Sign Message</Button>
            <Button onClick={signTransaction}>Sign Transaction</Button>
          </ButtonGroup>
        </Stack>
        <PublicAddress address={address} />

        <Paper variant="outlined">
          <Stack alignItems="center" padding={2}>
            <Typography variant="h1" component="div">
              {utils.formatEther(balance)} ETH
            </Typography>
          </Stack>
        </Paper>

        <List
          component="div"
          subheader={<ListSubheader component="div">Shares</ListSubheader>}
        >
          {items.map((number, index) => {
            return (
              <ListItem key={index}>
                <ListItemText secondary={`Party #${number}`}>
                  Key Share {index + 1}
                </ListItemText>
                <ButtonGroup
                  variant="outlined"
                  size="small"
                  aria-label="key share actions"
                >
                  <Button
                    onClick={() =>
                      onExportKeyShare(address, number, items.length)
                    }
                  >
                    Export
                  </Button>
                  <Button
                    color="error"
                    onClick={() =>
                      onDeleteKeyShare(address, number, items.length)
                    }
                  >
                    Delete
                  </Button>
                </ButtonGroup>
              </ListItem>
            );
          })}
        </List>

        <MessageProofs address={address} />
      </Stack>
    </>
  );
}
