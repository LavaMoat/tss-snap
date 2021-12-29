import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { PartySignup } from "../machine-common";

export interface Session {
  uuid: string;
  partySignup?: PartySignup;
}

export interface KeygenState {
  session?: Session;
}

const initialState: KeygenState = {
  session: null,
};

const keygenSlice = createSlice({
  name: "keygen",
  initialState,
  reducers: {
    setKeygen: (state, { payload }: PayloadAction<Session>) => {
      state.session = payload;
    },
  },
});

export const { setKeygen } = keygenSlice.actions;
export const keygenSelector = (state: { keygen: KeygenState }) => state.keygen;
export default keygenSlice.reducer;
