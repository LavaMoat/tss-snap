import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { GroupInfo, Session } from "@metamask/mpc-client";
import { Transport } from "../types";

export type SessionState = {
  group?: GroupInfo;
  session?: Session;
  transport?: Transport;
}

const initialState: SessionState = {
  group: null,
  session: null,
  transport: null,
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    setGroup: (state, { payload }: PayloadAction<GroupInfo>) => {
      state.group = payload;
    },
    setSession: (state, { payload }: PayloadAction<Session>) => {
      state.session = payload;
    },
    setTransport: (state, { payload }: PayloadAction<Transport>) => {
      state.transport = payload;
    },
  },
});

export const { setGroup, setSession, setTransport } =
  sessionSlice.actions;
export const sessionSelector = (state: { session: SessionState }) => state.session;
export default sessionSlice.reducer;
