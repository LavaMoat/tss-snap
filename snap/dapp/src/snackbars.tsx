import React from "react";
import { useDispatch, useSelector } from 'react-redux';

import {
  Snackbar,
  Alert,
} from "@mui/material";

import { snackbarsSelector, setSnackbar } from './store/snackbars';

export default function Snackbars() {
  const dispatch = useDispatch();
  const { snackbar } = useSelector(snackbarsSelector);
  const open = snackbar !== null;

  if (!snackbar) {
    return null;
  }

  const closeSnackbar = (
    event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch(setSnackbar(null));
  };

  return (
    <Snackbar open={open} autoHideDuration={4000} onClose={closeSnackbar}>
      <Alert onClose={closeSnackbar} severity={snackbar.severity}>
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
}
