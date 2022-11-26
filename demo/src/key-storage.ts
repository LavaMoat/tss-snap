import { KeyShare } from "@lavamoat/mpc-client";

const KEY = "keys";

export type KeyStorage = Map<[string, number, number], KeyShare>;

export function saveKeyShare(
  publicAddress: string,
  partyNumber: number,
  parties: number,
  keyShare: KeyShare
) {
  const keyData = loadKeys();
  keyData.set([publicAddress, partyNumber, parties], keyShare);
  localStorage.setItem(KEY, JSON.stringify(Array.from(keyData.entries())));
}

export function loadKeys(): KeyStorage {
  const keyData = localStorage.getItem(KEY);
  if (keyData) {
    try {
      const keyObject = JSON.parse(keyData);
      return new Map(keyObject);
    } catch (e) {
      console.warn("Could not deserialize JSON key data");
    }
  }
  return new Map();
}

// The way Javascript handles array equality means that using a tuple
// for a key fails if the two arrays are not the exact same instance.
//
// So we cannot use `Map.get()` but must search for the entry (or use string keys).
export function findKeyValue(
  keyData: KeyStorage,
  target: [string, number, number]
): KeyShare | null {
  for (const [key, value] of keyData) {
    if (key[0] === target[0] && key[1] === target[1] && key[2] === target[2]) {
      return value;
    }
  }
  return null;
}

export function loadKeysForParties(parties: number): KeyStorage {
  const keyData = loadKeys() as Map<[string, number, number], KeyShare>;
  const keyDataForParties = new Map();
  for (const [key, value] of keyData.entries()) {
    const [, , keyParties] = key;
    if (keyParties === parties) {
      keyDataForParties.set(key, value);
    }
  }
  return keyDataForParties;
}

export function removeKeys() {
  localStorage.removeItem(KEY);
}
