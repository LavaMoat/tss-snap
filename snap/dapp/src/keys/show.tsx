import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";

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

import PublicAddress from "../components/public-address";
import NotFound from "../not-found";
import KeysLoader from "./loader";
import TransactionReceipts from "./transaction-receipts";
import MessageProofs from "./message-proofs";
import BalanceChain from "./balance-chain";

export default function ShowKey() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { address } = useParams();
  const { keyShares, loaded } = useSelector(keysSelector);

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
              <Chip label={sharesLabel} />
            </Box>
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          <ButtonGroup variant="contained">
            <Button onClick={signMessage}>Sign Message</Button>
            <Button onClick={signTransaction}>Sign Transaction</Button>
          </ButtonGroup>
        </Stack>
        <PublicAddress address={address} abbreviate />

        <Paper variant="outlined">
          <Stack padding={2}>
            <BalanceChain />
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

        <TransactionReceipts address={address} />
        <MessageProofs address={address} />
      </Stack>
    </>
  );
}
