import init, {
  initThreadPool,
  initKeygen,
  startKeygen,
  handleKeygenIncoming,
  keygenWantsToProceed,
  keygenProceed,
  keygenCurrentRound,

  /*
  keygenRound1,
  keygenRound2,
  keygenRound3,
  keygenRound4,
  keygenRound5,
  createKey,
  signRound0,
  signRound1,
  signRound2,
  signRound3,
  signRound4,
  signRound5,
  signRound6,
  signRound7,
  signRound8,
  signRound9,
  signMessage,
  */
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

  // If we set `shared` to false we get: \
  //
  // LinkError: imported unshared memory but shared required
  const memory = new WebAssembly.Memory(
    {initial:18,maximum:16384,shared:true})
  await init(undefined, memory);
  //await initThreadPool(navigator.hardwareConcurrency);
  await initThreadPool(1);
})();

Comlink.expose({
  initKeygen,
  startKeygen,
  handleKeygenIncoming,
  keygenWantsToProceed,
  keygenProceed,
  keygenCurrentRound,

  /*
  keygenRound1,
  keygenRound2,
  keygenRound3,
  keygenRound4,
  keygenRound5,
  createKey,
  signRound0,
  signRound1,
  signRound2,
  signRound3,
  signRound4,
  signRound5,
  signRound6,
  signRound7,
  signRound8,
  signRound9,
  signMessage,
  */
  sha256,
});
