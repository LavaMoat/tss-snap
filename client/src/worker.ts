import init, { initThreadPool } from "ecdsa-wasm";
import * as Comlink from "comlink";

import { Parameters, PartySignup } from "./machine-common";

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
  await init();
  await initThreadPool(navigator.hardwareConcurrency);
})();

async function keygenRound1(params: Parameters, signup: PartySignup) {
  console.log("Worker keygen round 1 was called", params);
  console.log("Worker keygen round 1 was called", signup);
  return { params, signup };
}

Comlink.expose({ keygenRound1 });
