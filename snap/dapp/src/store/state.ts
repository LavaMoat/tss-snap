// Helper functions for saving and loading the snap state data.
import {
  encrypt as xchacha20poly1305Encrypt,
  decrypt as xchacha20poly1305Decrypt,
} from "@metamask/mpc-snap-wasm";

import { encode, decode } from "../utils";
import { AppState } from "../types";
import snapId from "../snap-id";

function getDefaultAppState(): AppState {
  return {
    keyShares: [],
    messageProofs: {},
  };
}

// Opaque private type for encrypted state information.
type AeadPack = {
  nonce: number[];
  ciphertext: number[];
};

// Key material returned from `getBip44Entropy_*`.
type KeyResponse = {
  key: string;
};

function decrypt(key: string, value: AeadPack): AppState {
  const buffer = xchacha20poly1305Decrypt(key, value);
  const decoded = decode(new Uint8Array(buffer));
  return JSON.parse(decoded);
}

function encrypt(key: string, value: AppState): AeadPack {
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
    throw new Error(`Private key material is not available, got: ${key}`);
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

export async function loadStateData(): Promise<AppState> {
  const state: AeadPack = (await getState()) as AeadPack;
  if (state !== null) {
    const key = await loadPrivateKey();
    return decrypt(key, state);
  }
  // Treat no state as a default empty state object
  return getDefaultAppState();
}

export async function saveStateData(appState: AppState): Promise<void> {
  const key = await loadPrivateKey();
  const aeadPack = encrypt(key, appState);
  await setState(aeadPack);
}

export async function clearStateData(): Promise<void> {
  const key = await loadPrivateKey();
  const aeadPack = encrypt(key, getDefaultAppState());
  await setState(aeadPack);
}
