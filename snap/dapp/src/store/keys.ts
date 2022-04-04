import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import snapId from '../snap-id';

type KeyMaterialResponse = {
  key: string;
}

export const loadPrivateKey = createAsyncThunk(
  "keys/loadPrivateKey",
  async () => {
      const response = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: [snapId, {
          method: 'getKey',
        }]
      });
      return (response as KeyMaterialResponse).key;
  }
);

type KeyShares = {}

export type KeyState = {
  privateKey?: string;
  keys: KeyShares;
}

const initialState: KeyState = {
  keys: null,
  privateKey: null,
};

const keySlice = createSlice({
  name: "keys",
  initialState,
  reducers: {
    setKeyShares: (state, { payload }: PayloadAction<KeyShares>) => {
      state.keys = payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadPrivateKey.fulfilled, (state, action) => {
      state.privateKey = action.payload;
    });
  },
});

export const { setKeyShares } = keySlice.actions;
export const keySelector = (state) => state.keys;
export default keySlice.reducer;
