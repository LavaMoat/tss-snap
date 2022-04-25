import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";

import {
  Stack,
  Button,
  Typography,
  List,
  ListItem,
  ListItemButton,
  CircularProgress,
} from "@mui/material";

import { keysSelector, loadKeys } from "../store/keys";

import Create from "./create";
import Join from "./join";
import ShowKey from "./show";
import Import from "./import";

import PublicAddress from "../components/public-address";

function Keys() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { keyShares } = useSelector(keysSelector);

  useEffect(() => {
    const onLoadKeys = async() => {
      // Load any saved key information
      await dispatch(loadKeys());
      setLoading(false);
    }
    onLoadKeys();
  }, [])

  const showKey = (address: string) => navigate(`/keys/${address}`);

  //const onImport = () => {
    //dispatch(setDialogVisible([IMPORT_KEY_STORE, true, null]));
  //}

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

  const main = loading ? (
    <Stack direction="row" spacing={2}>
      <CircularProgress size={20} />
      <Typography variant="body2" component="div" color="text.secondary">
        Loading key shares...
      </Typography>
    </Stack>
  ) : (
    <>

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
          Create a new key share
        </Button>
      </Stack>
    </>
  );

  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="div" gutterBottom>
        Keys
      </Typography>
      {main}
    </Stack>
  );
}

export { Keys, Create, Join, ShowKey, Import };
