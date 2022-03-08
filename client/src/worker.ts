import { LocalKey, Parameters, PartySignup } from "./state-machine";

import init, { initThreadPool, KeyGenerator, Signer, sha256 } from "ecdsa-wasm";
import * as Comlink from "comlink";

export { KeyGenerator, Signer } from "ecdsa-wasm";

export interface EcdsaWorker {
  KeyGenerator(
    parameters: Parameters,
    partySignup: PartySignup
  ): Promise<KeyGenerator>;

  Signer(
    index: number,
    participants: number[],
    localKey: LocalKey
  ): Promise<Signer>;

  sha256(value: string): Promise<string>;
}

// Temporary hack for getRandomValues() error
const getRandomValues = crypto.getRandomValues;
crypto.getRandomValues = function <T extends ArrayBufferView | null>(
  array: T
): T {
  const buffer = new Uint8Array(array as unknown as Uint8Array);
  const value = getRandomValues.call(crypto, buffer);
  (array as unknown as Uint8Array).set(value);
  return array;
};

// For top-level await typescript wants `target` to be es2017
// but this generates a "too much recursion" runtime error so
// we avoid top-level await for now
void (async function () {
  console.log("Worker is initializing...");
  await init();
  //await initThreadPool(navigator.hardwareConcurrency);
  await initThreadPool(1);
})();

Comlink.expose({
  KeyGenerator,
  Signer,
  sha256,
});
