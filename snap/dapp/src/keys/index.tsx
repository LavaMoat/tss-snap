import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import {
  Stack,
  Button,
  Typography,
  List,
  ListItem,
  ListItemButton,
} from "@mui/material";

import { keysSelector } from "../store/keys";

import Create from "./create";
import Join from "./join";
import ShowKey from "./show";
import Import from "./import";

import PublicAddress from "../components/public-address";
import KeysLoader from './loader';

function Keys() {
  const navigate = useNavigate();
  const { keyShares, loaded } = useSelector(keysSelector);

  if (!loaded) {
    return (
      <Stack spacing={2}>
        <Typography variant="h3" component="div" gutterBottom>
          Keys
        </Typography>
        <KeysLoader />
      </Stack>
    )
  }

  const showKey = (address: string) => navigate(`/keys/${address}`);

  const view =
    keyShares.length > 0 ? (
      <List component="div" disablePadding>
        {keyShares.map((share) => {
          const [address, { label }] = share;
          return (
            <ListItem
              key={address}
              disablePadding
              component="div"
              sx={{ display: "block" }}
            >
              <ListItemButton onClick={() => showKey(address)}>
                <Stack>
                  <Typography variant="subtitle2" component="div">
                    {label}
                  </Typography>
                  <PublicAddress address={address} abbreviate={true} />
                </Stack>
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    ) : (
      <Typography variant="body1" component="div" gutterBottom>
        No key shares yet.
      </Typography>
    );

  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="div" gutterBottom>
        Keys
      </Typography>
      {view}
      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          href="#/keys/import">
          Import from keystore
        </Button>
        <Button
          variant="contained"
          href="#/keys/create">
          Create a new key
        </Button>
      </Stack>
    </Stack>
  );
}

export { Keys, Create, Join, ShowKey, Import };
