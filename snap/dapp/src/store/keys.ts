import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

import {
  encrypt as xchacha20poly1305Encrypt,
  decrypt as xchacha20poly1305Decrypt,
} from "@metamask/mpc-snap-wasm";

import { GroupInfo, Session, KeyShare } from "@metamask/mpc-client";

import { Transport } from "../types";

import snapId from "../snap-id";

type AeadPack = {
  nonce: number[];
  ciphertext: number[];
};

export type NamedKeyShare = {
  label: string;
  share: KeyShare;
};

type KeyShareGroup = {
  label: string;
  threshold: number;
  parties: number;
  items: number[];
};

type KeyList = [string, KeyShareGroup][];

type KeyMap = {
  [key: string]: KeyShareGroup;
};

// Group key shares by public address containing only enough
// information for listing and showing key shares.
export function groupKeys(keyShares: NamedKeyShare[]): KeyList {
  // Group key shares by public address
  const addressGroups = keyShares.reduce((previous: KeyMap, namedKeyShare) => {
    const { label, share } = namedKeyShare;
    const { address, localKey } = share;
    const { i: number, t: threshold, n: parties } = localKey;
    previous[address] = previous[address] || {
      label,
      threshold,
      parties,
      items: [],
    };
    previous[address].items.push(number);
    previous[address].items.sort();
    return previous;
  }, {});

  return Object.entries(addressGroups);
}

// Key material returned from `getBip44Entropy_*`.
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

function decrypt(key: string, value: AeadPack): NamedKeyShare[] {
  const buffer = xchacha20poly1305Decrypt(key, value);
  const decoded = decode(new Uint8Array(buffer));
  return JSON.parse(decoded);
}

function encrypt(key: string, value: NamedKeyShare[]): AeadPack {
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
  async (keyShares: NamedKeyShare[]) => {
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
  // Key share awaiting confirmation to be saved.
  //
  // Ideally we would save this automatically in `compute`
  // at the end of key generation but for testing where a single
  // party is generating multiple key shares there is a data race
  // persisting the snap state that can cause some key shares not
  // to be saved correctly.
  //
  // Therefore we need a manually triggered action on the `save` screen
  // to prevent the race.
  keyShare?: NamedKeyShare;
};

const initialState: KeyState = {
  group: null,
  session: null,
  transport: null,
  keyShare: null,
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
    setKeyShare: (state, { payload }: PayloadAction<NamedKeyShare>) => {
      state.keyShare = payload;
    },
  },
  //extraReducers: (builder) => {},
});

export const { setGroup, setSession, setTransport, setKeyShare } =
  keySlice.actions;
export const keysSelector = (state: { keys: KeyState }) => state.keys;
export default keySlice.reducer;
