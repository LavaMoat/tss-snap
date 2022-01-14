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

export function loadKeysForParties(parties: number): KeyStorage {
  const keyData = loadKeys() as Map<[string, number, number], PartyKey>;
  const keyDataForParties = new Map();
  for (const [key, value] of keyData.entries()) {
    const [_publicAddress, _partyNumber, keyParties] = key;
    if (keyParties === parties) {
      keyDataForParties.set(key, value);
    }
  }
  return keyDataForParties;
}

export function removeKeys() {
  localStorage.removeItem(KEY);
}
