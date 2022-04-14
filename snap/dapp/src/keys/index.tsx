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

      // Group key shares by public address
      const addressGroups = keyShares.reduce((previous, namedKeyShare) => {
        const { label, share } = namedKeyShare;
        const { address, localKey } = share;
        const { i: number, t: threshold, n: parties } = localKey;

        previous[address] = previous[address] || {label, items: []};
        const item = { label, number, threshold, parties };
        previous[address].items.push(item);

        return previous;
      }, {});

      // Ensure shares are ordered according to their party number
      for (const keyShare of Object.values(addressGroups)) {
        keyShare.items.sort((a, b) => {
          const an = a.number;
          const bn = b.number;
          if (an < bn) {
            return -1;
          }
          if (an > bn) {
            return 1;
          }
          return 0;
        });
      }
      setShares(Object.entries(addressGroups));
    };

    loadKeys();
  }, []);

  const view =
    shares.length > 0 ? (
      <List component="div" disablePadding >
        {shares.map((share, index) => {
          const [address, {label, items}] = share;

          console.log(address, label, items);

          return (
            <div key={address}>
              <ListItemText primary={label} secondary={address} />
              <List component="div" disablePadding>
                {items.map((item, index) => {
                  const {number, threshold, parties} = item;
                  const primary = `Share ${number}`;
                  const secondary = `In ${threshold + 1} of ${parties}`;
                  return (
                    <ListItem key={index}>
                      <ListItemText primary={primary} secondary={secondary} />
                    </ListItem>
                  )
                })}
              </List>

            </div>
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
