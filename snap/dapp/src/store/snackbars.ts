import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { AlertColor } from "@mui/material";

export type SnackbarInfo = {
  message: string;
  severity: AlertColor;
};

export type SnackbarState = {
  snackbar?: SnackbarInfo;
};

const initialState: SnackbarState = {
  snackbar: null,
};

const snackbarsSlice = createSlice({
  name: "snackbars",
  initialState,
  reducers: {
    setSnackbar: (state, { payload }: PayloadAction<SnackbarInfo>) => {
      state.snackbar = payload;
    },
  },
});

export const { setSnackbar } = snackbarsSlice.actions;
export const snackbarsSelector = (state: { snackbars: SnackbarState }) =>
  state.snackbars;
export default snackbarsSlice.reducer;
