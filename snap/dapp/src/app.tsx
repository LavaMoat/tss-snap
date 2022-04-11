import React, {useEffect, useState, useMemo} from "react";
import init from '@metamask/mpc-snap-wasm';
import {useDispatch} from 'react-redux';
import {loadState, saveState, clearState} from './store/keys';
import snapId from './snap-id';

import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';


import useMediaQuery from "@mui/material/useMediaQuery";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { createTheme } from "@mui/material/styles";

function MainAppBar() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Stack direction="row" padding={1} spacing={2}>
          <img src="/images/icon.svg" width="32" />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Threshold Signatures
          </Typography>
        </Stack>
      </AppBar>
    </Box>
  );
}

function Content() {
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
    <Stack
      paddingTop={4}
      alignItems="center"
      justifyContent="center">

      <Typography variant="body1" component="div" gutterBottom>
        To begin you should have installed MetaMask Flask and then you can
        connect.
      </Typography>

      <Button variant="contained" onClick={connect}>Connect</Button>
    </Stack>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const [ready, setReady] = useState(false);


  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? "dark" : "light",
        },
      }),
    [prefersDarkMode]
  );

  useEffect(() => {
    const initialize = async () => {
      // Setup the wasm helpers
      await init();
      setReady(true);
    }
    initialize();
  }, []);

  if (ready === false) {
    return null;
  }

  return (
    <ThemeProvider theme={theme}>
      <>
        <CssBaseline />
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <MainAppBar />
          <Content />
        </div>
      </>
    </ThemeProvider>
  );
}
