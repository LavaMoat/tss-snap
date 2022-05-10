// Helper functions for saving and loading the snap state data.
import {
  encrypt as xchacha20poly1305Encrypt,
  decrypt as xchacha20poly1305Decrypt,
} from "@metamask/mpc-snap-wasm";

import { encode, decode } from "../utils";
import { NamedKeyShare } from "../types";

import snapId from "../snap-id";

// Opaque private type for encrypted state information.
type AeadPack = {
  nonce: number[];
  ciphertext: number[];
};

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

export async function loadPrivateKey() {
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

export const loadStateData = async () => {
  const state: AeadPack = (await getState()) as AeadPack;
  if (state !== null) {
    const key = await loadPrivateKey();
    return decrypt(key, state);
  }
  // Treat no state as zero key shares
  return [];
};

export const saveStateData = async (keyShares: NamedKeyShare[]) => {
  const key = await loadPrivateKey();
  const aeadPack = encrypt(key, keyShares);
  await setState(aeadPack);
};

export const clearStateData = async () => {
  const key = await loadPrivateKey();
  const aeadPack = encrypt(key, []);
  await setState(aeadPack);
};
