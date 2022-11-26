import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Stack, Typography, CircularProgress } from "@mui/material";

import { AppDispatch } from "../store";
import { keysSelector, loadKeys } from "../store/keys";

export default function KeysLoader() {
  const dispatch: AppDispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const { loaded } = useSelector(keysSelector);

  useEffect(() => {
    const onLoadKeys = async () => {
      // Load any saved key information
      await dispatch(loadKeys());
      setLoading(false);
    };
    if (!loaded) {
      onLoadKeys();
    }
  }, []);

  if (loading) {
    return (
      <Stack direction="row" spacing={2}>
        <CircularProgress size={20} />
        <Typography variant="body2" component="div" color="text.secondary">
          Loading key shares...
        </Typography>
      </Stack>
    );
  }
  return null;
}
