import React, {useEffect, useState, useMemo} from "react";
//import init from '@metamask/mpc-snap-wasm';
//import {useDispatch} from 'react-redux';

import {
  Stack,
  Box,
  Button,
  Link,
  Typography,
} from '@mui/material';

export default function Connect() {
  async function connect () {
    try {
      await ethereum.request({
        method: 'wallet_enable',
        params: [{
          wallet_snap: { [snapId]: {} },
        }]
      })

      /*
      await dispatch(clearState());

      const {payload: keyShares} = await dispatch(loadState());
      console.log("Got key shares", keyShares);
      */

      /*
      keyShares.push({label: 'Mock Key Share'});
      console.log("After append", keyShares);

      // Update with amended state
      await dispatch(saveState(keyShares));
      */

      /*
      // Check the new state is good
      const {payload: newKeyShares} = await dispatch(loadState());
      console.log("After saveState", newKeyShares);
      */

    } catch(e) {
      // TODO: handle snap connect failure.
      console.error(e);
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="div">
        Connect
      </Typography>

      <Typography variant="body1" component="div" gutterBottom>
        To begin you should have installed <Link href="https://metamask.io/flask/">MetaMask Flask</Link> and then you can
        connect.
      </Typography>

      <Button variant="contained" onClick={connect}>Connect to MetaMask</Button>
    </Stack>
  );
}
