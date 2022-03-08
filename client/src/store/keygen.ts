import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { KeyShare, Session } from "../mpc";

export interface KeygenState {
  session?: Session;
  keyShare?: KeyShare;
}

const initialState: KeygenState = {
  session: null,
  keyShare: null,
};

const keygenSlice = createSlice({
  name: "keygen",
  initialState,
  reducers: {
    setKeygenSession: (state, { payload }: PayloadAction<Session>) => {
      state.session = payload;
    },
    setKeyShare: (state, { payload }: PayloadAction<KeyShare>) => {
      state.keyShare = payload;
    },
  },
});

export const { setKeygenSession, setKeyShare } = keygenSlice.actions;
export const keygenSelector = (state: { keygen: KeygenState }) => state.keygen;
export default keygenSlice.reducer;
