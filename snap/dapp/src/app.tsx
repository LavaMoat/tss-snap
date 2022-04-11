import React, { useEffect, useState, useMemo } from "react";
import init from "@metamask/mpc-snap-wasm";

import { Routes, Route } from "react-router-dom";

import AppBar from "@mui/material/AppBar";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import useMediaQuery from "@mui/material/useMediaQuery";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { createTheme } from "@mui/material/styles";

import Connect from "./connect";
import Keys from "./keys";
import Create from "./create";

const NotFound = () => (
  <Typography variant="h3" component="div">
    Page not found
  </Typography>
);

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
  return (
    <Box padding={7}>
      <Routes>
        <Route path="/" element={<Connect />} />
        <Route path="/keys" element={<Keys />} />
        <Route path="/keys/create" element={<Create />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Box>
  );
}

export default function App() {
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
    };
    initialize();
  }, []);

  if (ready === false) {
    return null;
  }

  return (
    <ThemeProvider theme={theme}>
      <>
        <CssBaseline />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <MainAppBar />
          <Content />
        </div>
      </>
    </ThemeProvider>
  );
}
