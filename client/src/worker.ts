import init, {
  initThreadPool,
  keygenInit,
  keygenHandleIncoming,
  keygenProceed,
  keygenCreate,
  signInit,
  signHandleIncoming,
  signProceed,
  signPartial,
  signCreate,
  sha256,
} from "ecdsa-wasm";
import * as Comlink from "comlink";

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
  keygenInit,
  keygenHandleIncoming,
  keygenProceed,
  keygenCreate,
  signInit,
  signHandleIncoming,
  signProceed,
  signPartial,
  signCreate,
  sha256,
});
