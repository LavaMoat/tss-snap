import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";

import {
  Stack,
  Button,
  Typography,
  List,
  ListItem,
  ListItemButton,
} from "@mui/material";

import { keysSelector } from "../store/keys";
import { setDialogVisible, IMPORT_KEY_STORE } from "../store/dialogs";

import Create from "./create";
import Join from "./join";
import ShowKey from "./show";

import PublicAddress from "./public-address";

function Keys() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { keyShares } = useSelector(keysSelector);

  const showKey = (address: string) => navigate(`/keys/${address}`);

  const onImport = () => {
    console.log("Do import...");
    dispatch(setDialogVisible([IMPORT_KEY_STORE, true, null]));
  }

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
          onClick={onImport}
        >
          Import from keystore
        </Button>

        <Button
          variant="contained"
          href="#/keys/create">
          Create a new key share
        </Button>
      </Stack>
    </Stack>
  );
}

export { Keys, Create, Join, ShowKey };
