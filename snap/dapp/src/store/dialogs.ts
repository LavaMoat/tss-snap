import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { Dictionary } from "../utils";

export const CONFIRM_DELETE_KEY_SHARE = "confirm-delete-key-share";
export const EXPORT_KEY_STORE = "export-key-store";
export const CONFIRM_DELETE_MESSAGE_PROOF = "confirm-delete-message-proof";

const dialogs: DialogDict = {};
dialogs[CONFIRM_DELETE_KEY_SHARE] = [false, null];
dialogs[EXPORT_KEY_STORE] = [false, null];
dialogs[CONFIRM_DELETE_MESSAGE_PROOF] = [false, null];

export type DialogDict = Dictionary<[boolean, unknown?]>;

export type DialogState = {
  dialogs: DialogDict;
};

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
