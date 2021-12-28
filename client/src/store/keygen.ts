import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Session {
  uuid: string;
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
