import React, { useEffect, useState, useMemo } from "react";
import init from "@metamask/mpc-snap-wasm";

import { Routes, Route } from "react-router-dom";
import detectEthereumProvider from "@metamask/detect-provider";

import AppBar from "@mui/material/AppBar";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import useMediaQuery from "@mui/material/useMediaQuery";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { createTheme } from "@mui/material/styles";

import WebSocketProvider from "./websocket-provider";
import WorkerProvider, { webWorker } from "./worker";

import Connect from "./connect";
import Dialogs from "./dialogs";
import Snackbars from "./snackbars";
import { Keys, Create, Join, ShowKey, Import } from "./keys";
import NotFound from "./not-found";

type WorkerMessage = {
  data: { ready: boolean };
};

function MainAppBar() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ pl: 4, pr: 4, pt: 1, pb: 1 }}>
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
  return (
    <Box padding={5}>
      <Routes>
        <Route path="/" element={<Connect />} />
        <Route path="/keys/create" element={<Create />} />
        <Route path="/keys/import" element={<Import />} />
        <Route path="/keys/join/:groupId/:sessionId" element={<Join />} />
        <Route path="/keys/:address" element={<ShowKey />} />
        <Route path="/keys" element={<Keys />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Box>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [provider, setProvider] = useState(null);

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
      const provider = await detectEthereumProvider();
      setProvider(provider);

      // Setup the wasm helpers that run on the main UI thread
      await init();

      // Now we are ready to render
      setReady(true);
    };

    // Wait for the worker webassembly to be ready
    const onWorkerReady = (msg: WorkerMessage) => {
      if (msg.data.ready) {
        webWorker.removeEventListener("message", onWorkerReady);
        initialize();
      }
    };

    webWorker.addEventListener("message", onWorkerReady);
  }, []);

  if (ready === false) {
    return null;
  }

  if (!provider) {
    return (
      <p>
        Failed to detect an ethereum provider, please install{" "}
        <a href="https://metamask.io/flask/">MetaMask Flask</a>
      </p>
    );
  }

  if (provider !== window.ethereum) {
    return (
      <p>
        The wallet provider is not correct, do you have multiple wallets
        installed?
      </p>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <>
        <CssBaseline />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <WebSocketProvider>
            <WorkerProvider>
              <MainAppBar />
              <Content />
              <Dialogs />
              <Snackbars />
            </WorkerProvider>
          </WebSocketProvider>
        </div>
      </>
    </ThemeProvider>
  );
}
