import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { Dictionary } from '../utils';

export const CONFIRM_DELETE_KEY_SHARE = "confirm-delete-key-share";

const dialogs: DialogDict = {};
dialogs[CONFIRM_DELETE_KEY_SHARE] = [false, null];

export type DialogDict = Dictionary<[boolean, unknown?]>;

export type DialogState = {
  dialogs: DialogDict;
}

const initialState: DialogState = { dialogs };

const dialogsSlice = createSlice({
  name: "dialogs",
  initialState,
  reducers: {
    setDialogVisible: (
      state,
      { payload }: PayloadAction<[string, boolean, unknown]>
    ) => {
      const [key, value, data] = payload;
      const dialogs = Object.assign(state.dialogs);
      dialogs[key] = [value, data];
      state.dialogs = dialogs;
    },
  },
});

export const { setDialogVisible } = dialogsSlice.actions;
export const dialogsSelector = (state: { dialogs: DialogState }) =>
  state.dialogs;
export default dialogsSlice.reducer;
