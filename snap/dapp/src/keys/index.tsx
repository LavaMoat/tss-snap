import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import {
  Box,
  Stack,
  ButtonGroup,
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

import PublicAddress from "./public-address";

function Keys() {
  const navigate = useNavigate();
  const { keyShares } = useSelector(keysSelector);

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

export { Keys, Create, Join, ShowKey };
