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
  Snackbar,
  Alert,
} from "@mui/material";

import { keysSelector, deleteKey } from "../store/keys";
import { setDialogVisible, CONFIRM_DELETE_KEY_SHARE } from "../store/dialogs";
import { chains } from "../utils";

import PublicAddress from "./public-address";
import NotFound from "../not-found";

export default function ShowKey() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { address } = useParams();
  const { keyShares } = useSelector(keysSelector);

  //const [deleted, setDeleted] = useState(false);
  const [balance, setBalance] = useState("0x0");
  const [chain, setChain] = useState<string>(null);

  const keyShare = keyShares.find((item) => {
    const [keyAddress] = item;
    return keyAddress === address;
  });

  useEffect(() => {
    ethereum.on("chainChanged", handleChainChanged);

    function handleChainChanged() {
      window.location.reload();
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

  if (!keyShare) {
    return <NotFound />;
  }

  const onDeleteKeyShare = async (
    address: string, number: number, length: number) => {
    dispatch(
      setDialogVisible(
        [CONFIRM_DELETE_KEY_SHARE, true, [address, number, length]]))
  }

  const share = keyShare[1];
  const { label, threshold, parties, items } = share;
  const sharesLabel = `${items.length} share(s) in a ${
    threshold + 1
  } of ${parties}`;

  if (!chain) {
    return null;
  }

  const chainName = chains[chain] as string;


      //<Snackbar
        //open={deleted}
        //autoHideDuration={3000}
        //onClose={() => setDeleted(false)}
      //>
        //<Alert onClose={() => setDeleted(false)} severity="success">
          //Key share deleted
        //</Alert>
      //</Snackbar>

  return (
    <>
      <Stack spacing={2}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link underline="hover" color="inherit" href="#/keys">
            Keys
          </Link>
          <Typography color="text.primary">{label}</Typography>
        </Breadcrumbs>

        <Typography variant="h3" component="div">
          {label}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Box>
            <Chip label={chainName} />
          </Box>
          <Box>
            <Chip label={sharesLabel} />
          </Box>
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
          subheader={
            <ListSubheader component="div">
              Shares
            </ListSubheader>
          }
        >
          {
            items.map((number, index) => {
              return (
                <ListItem key={index}>
                  <ListItemText secondary={`Party #${number}`}>Key Share {index + 1}</ListItemText>
                  <ButtonGroup
                    variant="outlined" size="small" aria-label="key share actions">
                    <Button>Export</Button>
                    <Button color="error" onClick={() => onDeleteKeyShare(address, number, items.length)}>Delete</Button>
                  </ButtonGroup>
                </ListItem>
              );
            })
          }
        </List>

      </Stack>

    </>
  );
}
