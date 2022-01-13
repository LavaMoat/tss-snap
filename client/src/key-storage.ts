import { Parameters, PartyKey } from "./state-machine";

const KEY = "keys";

type KeyStorage = Map<[string, number, number], PartyKey>;

export function saveKeyShare(
  publicAddress: string,
  partyNumber: number,
  parties: number,
  keyShare: PartyKey
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

export function removeKeys() {
  localStorage.removeItem(KEY);
}
