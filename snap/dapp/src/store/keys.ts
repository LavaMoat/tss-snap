import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {encrypt, decrypt} from '@metamask/mpc-snap-wasm';
import snapId from '../snap-id';

type AeadPack = {
  nonce: number[],
  ciphertext: number[],

}

type KeyMaterialResponse = {
  key: string;
}

function encode(value: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(value);
}

function decode(value: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(value);
}

export function decryptAndDecode(key: string, value: AeadPack): KeyShare[] {
  const buffer = decrypt(key, value);
  const decoded = decode(new Uint8Array(buffer));
  return JSON.parse(decoded);
}

export function encodeAndEncrypt(key: string, value: KeyShare[]): AeadPack {
  const json = JSON.stringify(value);
  const encoded = encode(json);
  return encrypt(key, Array.from(encoded));
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

type KeyShare = {
  label: string;
}

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
    setKeyShares: (state, { payload }: PayloadAction<KeyShare[]>) => {
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
export const keySelector = (state: {keys: KeyState}) => state.keys;
export default keySlice.reducer;
