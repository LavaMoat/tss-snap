import { PartyKey } from "./state-machine";

const KEY = "keys";

type KeyItem = [number, PartyKey];
type KeyStorage = Map<string, KeyItem>;

export function saveKeyShare(
  publicAddress: string,
  partyNumber: number,
  keyShare: PartyKey
) {
  let keyData = loadKeys();
  keyData.set(publicAddress, [partyNumber, keyShare]);
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

export function removeKeys() {
  localStorage.removeItem(KEY);
}
