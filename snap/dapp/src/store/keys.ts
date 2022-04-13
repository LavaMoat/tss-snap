import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

import {
  encrypt as xchacha20poly1305Encrypt,
  decrypt as xchacha20poly1305Decrypt,
} from "@metamask/mpc-snap-wasm";

import { GroupInfo, Session } from "@metamask/mpc-client";

import { Transport } from "../types";

import snapId from "../snap-id";

type AeadPack = {
  nonce: number[];
  ciphertext: number[];
};

type KeyShare = {
  label: string;
};

type KeyResponse = {
  key: string;
};

function encode(value: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(value);
}

function decode(value: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(value);
}

function decrypt(key: string, value: AeadPack): KeyShare[] {
  const buffer = xchacha20poly1305Decrypt(key, value);
  const decoded = decode(new Uint8Array(buffer));
  return JSON.parse(decoded);
}

function encrypt(key: string, value: KeyShare[]): AeadPack {
  const json = JSON.stringify(value);
  const encoded = encode(json);
  return xchacha20poly1305Encrypt(key, Array.from(encoded));
}

async function loadPrivateKey() {
  const response = await ethereum.request({
    method: "wallet_invokeSnap",
    params: [
      snapId,
      {
        method: "getKey",
      },
    ],
  });
  return (response as KeyResponse).key;
}

async function getState() {
  return await ethereum.request({
    method: "wallet_invokeSnap",
    params: [
      snapId,
      {
        method: "getState",
      },
    ],
  });
}

async function setState(value: AeadPack) {
  return await ethereum.request({
    method: "wallet_invokeSnap",
    params: [
      snapId,
      {
        method: "updateState",
        params: value,
      },
    ],
  });
}

export const loadState = createAsyncThunk("keys/loadState", async () => {
  const state: AeadPack = (await getState()) as AeadPack;
  if (state !== null) {
    const key = await loadPrivateKey();
    return decrypt(key, state);
  }
  // Treat no state as zero key shares
  return [];
});

export const saveState = createAsyncThunk(
  "keys/saveState",
  async (keyShares: KeyShare[]) => {
    const key = await loadPrivateKey();
    const aeadPack = encrypt(key, keyShares);
    await setState(aeadPack);
  }
);

export const clearState = createAsyncThunk("keys/clearState", async () => {
  const key = await loadPrivateKey();
  const aeadPack = encrypt(key, []);
  await setState(aeadPack);
});

export type KeyState = {
  group?: GroupInfo;
  session?: Session;
  transport?: Transport;
};

const initialState: KeyState = {
  group: null,
  session: null,
  transport: null,
};

const keySlice = createSlice({
  name: "keys",
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
  //extraReducers: (builder) => {},
});

export const { setGroup, setSession, setTransport } = keySlice.actions;
export const keysSelector = (state: { keys: KeyState }) => state.keys;
export default keySlice.reducer;
