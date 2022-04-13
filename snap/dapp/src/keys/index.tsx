import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import {
  Stack,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";

import { loadState, NamedKeyShare } from "../store/keys";

import Create from "./create";
import Join from "./join";

function Keys() {
  const dispatch = useDispatch();

  const [shares, setShares] = useState([]);

  useEffect(() => {
    const loadKeys = async () => {
      const { payload: keyShares } = await dispatch(loadState());
      console.log(keyShares);

      const shares = keyShares.map((namedKeyShare: NamedKeyShare) => {
        const { label } = namedKeyShare;
        return { label };
      });

      setShares(shares);
    };

    loadKeys();
  }, []);

  const view =
    shares.length > 0 ? (
      <List component="div" disablePadding>
        {shares.map((share, index) => {
          return (
            <ListItem key={index}>
              <ListItemText primary={share.label} />
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
