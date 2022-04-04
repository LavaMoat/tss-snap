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

export const getState = createAsyncThunk(
  "keys/getState",
  async () => {
      return await ethereum.request({
        method: 'wallet_invokeSnap',
        params: [snapId, {
          method: 'getState',
        }]
      });
  }
);

export const setState = createAsyncThunk(
  "keys/setState",
  async (value: unknown) => {
      return await ethereum.request({
        method: 'wallet_invokeSnap',
        params: [snapId, {
          method: 'updateState',
          params: value,
        }]
      });
  }
);

//inpage.js:1 MetaMask - RPC Error: this.controllerMessenger is not a function {code: -32603, message: 'this.controllerMessenger is not a function', data: {…}}
export const clearState = createAsyncThunk(
  "keys/clearState",
  async () => {
      await ethereum.request({
        method: 'wallet_invokeSnap',
        params: [snapId, {
          method: 'clearState',
        }]
      });
  }
);

type KeyShare = {}

export type KeyState = {
  privateKey?: string;
  keys: KeyShare[];
}

const initialState: KeyState = {
  keys: [],
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
    //builder.addCase(clearState.fulfilled, (state, action) => {
      //state.keys = [];
    //});
  },
});

export const { setKeyShares } = keySlice.actions;
export const keySelector = (state) => state.keys;
export default keySlice.reducer;
