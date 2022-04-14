import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

import {
  Box,
  Stack,
  ButtonGroup,
  Button,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemButton,
  Tooltip,
} from "@mui/material";

import CopyIcon from "@mui/icons-material/ContentCopy";

import { loadState, groupKeys } from "../store/keys";
import { copyToClipboard, abbreviateAddress } from "../utils";

import Create from "./create";
import Join from "./join";

function Keys() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [shares, setShares] = useState([]);

  const copyAddress = async (
    e: React.MouseEvent<HTMLElement>,
    address: string
  ) => {
    e.stopPropagation();
    await copyToClipboard(address);
  };

  const showKey = (address: string) => navigate(`/keys/${address}`);

  useEffect(() => {
    const loadKeys = async () => {
      const { payload: keyShares } = await dispatch(loadState());
      setShares(groupKeys(keyShares));
    };

    loadKeys();
  }, []);

  const view =
    shares.length > 0 ? (
      <List component="div" disablePadding>
        {shares.map((share) => {
          const [address, { label, threshold, parties, items }] = share;
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
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="body2"
                      component="div"
                      color="text.secondary"
                    >
                      {abbreviateAddress(address)}
                    </Typography>
                    <Tooltip title="Copy address">
                      <IconButton onClick={(e) => copyAddress(e, address)}>
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Typography
                    variant="body2"
                    component="div"
                    color="text.secondary"
                  >
                    {items.length} share(s) in a {threshold + 1} of {parties}
                  </Typography>
                </Stack>

                <Box sx={{ flexGrow: 1 }} />

                <ButtonGroup
                  variant="outlined"
                  aria-label="outlined button group"
                >
                  <Button>Sign</Button>
                </ButtonGroup>
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

      <Button
        variant="contained"
        href="#/keys/create"
        onClick={() => console.log("create key share")}
      >
        Create a new key share
      </Button>
    </Stack>
  );
}

export { Keys, Create, Join };
