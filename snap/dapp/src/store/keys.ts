import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

import {
  encrypt as xchacha20poly1305Encrypt,
  decrypt as xchacha20poly1305Decrypt,
} from "@metamask/mpc-snap-wasm";

import { KeyShare } from "@metamask/mpc-client";

import { encode, decode } from "../utils";

import snapId from "../snap-id";

type AeadPack = {
  nonce: number[];
  ciphertext: number[];
};

export type NamedKeyShare = {
  label: string;
  share: KeyShare;
};

export type KeyShareGroup = {
  label: string;
  threshold: number;
  parties: number;
  items: number[];
};

export type KeyList = [string, KeyShareGroup][];

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
  const key = (response as KeyResponse).key;
  if (!key) {
    throw new Error(`private key material is not available, got: ${key}`);
  }
  return key;
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

const loadStateData = async () => {
  const state: AeadPack = (await getState()) as AeadPack;
  if (state !== null) {
    const key = await loadPrivateKey();
    return decrypt(key, state);
  }
  // Treat no state as zero key shares
  return [];
};

const saveStateData = async (keyShares: NamedKeyShare[]) => {
  const key = await loadPrivateKey();
  const aeadPack = encrypt(key, keyShares);
  await setState(aeadPack);
};

const loadKeyData = async () => {
  const keys = await loadStateData();
  return groupKeys(keys);
};

export const findKeyShare = async (
  keyAddress: string,
  partyNumber: number
): Promise<NamedKeyShare | undefined> => {
  const keys = await loadStateData();
  return keys.find((namedKeyShare) => {
    const { share } = namedKeyShare;
    const { address, localKey } = share;
    const { i: number } = localKey;
    return keyAddress === address && partyNumber === number;
  });
};

export const loadState = createAsyncThunk("keys/loadState", loadStateData);
export const saveState = createAsyncThunk("keys/saveState", saveStateData);
export const clearState = createAsyncThunk("keys/clearState", async () => {
  const key = await loadPrivateKey();
  const aeadPack = encrypt(key, []);
  await setState(aeadPack);
});

export const loadKeys = createAsyncThunk("keys/loadKeys", loadKeyData);
export const saveKey = createAsyncThunk(
  "keys/saveKeyShare",
  async (keyShare: NamedKeyShare) => {
    const keys = await loadStateData();
    keys.push(keyShare);
    await saveStateData(keys);
    return await loadKeyData();
  }
);

// Request used to delete a key share using it's
// address and party number.
type DeleteKeyShare = [string, number];

export const deleteKey = createAsyncThunk(
  "keys/deleteKeyShare",
  async (deleteRequest: DeleteKeyShare) => {
    const [address, number] = deleteRequest;
    const keys = await loadStateData();
    const newKeys = keys.filter((item: NamedKeyShare) => {
      const { share } = item;
      const { address: itemAddress, localKey } = share;
      const { i: itemNumber } = localKey;
      return !(address === itemAddress && number === itemNumber);
    });
    await saveStateData(newKeys);
    return await loadKeyData();
  }
);

export type KeyState = {
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

  // Sanitized list of key information without any private data.
  keyShares: KeyList;

  // Has an initial load operation of the key shares happened?
  //
  // Used so that deep links can load key shares on demand.
  loaded: boolean;
};

const initialState: KeyState = {
  keyShare: null,
  keyShares: [],
  loaded: false,
};

const keySlice = createSlice({
  name: "keys",
  initialState,
  reducers: {
    setKeyShare: (state, { payload }: PayloadAction<NamedKeyShare>) => {
      state.keyShare = payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadKeys.fulfilled, (state, action) => {
      state.keyShares = action.payload;
      state.loaded = true;
    });
    builder.addCase(saveKey.fulfilled, (state, action) => {
      state.keyShares = action.payload;
    });
    builder.addCase(deleteKey.fulfilled, (state, action) => {
      state.keyShares = action.payload;
    });
  },
});

export const { setKeyShare } = keySlice.actions;
export const keysSelector = (state: { keys: KeyState }) => state.keys;
export default keySlice.reducer;
