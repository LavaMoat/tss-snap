import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type SnackbarInfo = {
  message: string;
  severity: string;
}

export type SnackbarState = {
  snackbar?: SnackbarInfo;
}

const initialState: SnackbarState = {
  snackbar: null,
}

const snackbarsSlice = createSlice({
  name: "snackbars",
  initialState,
  reducers: {
    setSnackbar: (
      state,
      { payload }: PayloadAction<SnackbarState>
    ) => {
      state.snackbar = payload;
    },
  },
});

export const { setSnackbar } = snackbarsSlice.actions;
export const snackbarsSelector = (state: { snackbars: SnackbarState }) =>
  state.snackbars;
export default snackbarsSlice.reducer;
