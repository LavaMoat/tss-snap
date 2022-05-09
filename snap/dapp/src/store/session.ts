import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { GroupInfo, Session } from "@metamask/mpc-client";
import { Transport, SignValue, SigningType } from "../types";

export type SignCandidate = {
  address: string;
  value: SignValue;
  selectedParty: number;
  signingType: SigningType;
  creator: boolean;
};

export type SessionState = {
  group?: GroupInfo;
  session?: Session;
  transport?: Transport;
  signCandidate?: SignCandidate;
};

const initialState: SessionState = {
  group: null,
  session: null,
  transport: null,
  signCandidate: null,
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
    setSignCandidate: (state, { payload }: PayloadAction<SignCandidate>) => {
      state.signCandidate = payload;
    },
  },
});

export const { setGroup, setSession, setTransport, setSignCandidate } =
  sessionSlice.actions;
export const sessionSelector = (state: { session: SessionState }) =>
  state.session;
export default sessionSlice.reducer;
