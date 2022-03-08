import {
  Message,
  LocalKey,
  Parameters,
  PartySignup,
  PartialSignature,
  SignMessage,
} from "./state-machine";

import init, {
  initThreadPool,
  KeyGenerator,
  signInit,
  signHandleIncoming,
  signProceed,
  signPartial,
  signCreate,
  sha256,
} from "ecdsa-wasm";
import * as Comlink from "comlink";

export interface EcdsaWorker {
  KeyGenerator(parameters: Parameters, partySignup: PartySignup): Promise<void>;
  signInit(
    index: number,
    participants: number[],
    localKey: LocalKey
  ): Promise<void>;
  signHandleIncoming(message: Message): Promise<void>;
  signProceed(): Promise<[number, Message[]]>;
  signPartial(message: string): Promise<PartialSignature>;
  signCreate(partials: PartialSignature[]): Promise<SignMessage>;

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
  signInit,
  signHandleIncoming,
  signProceed,
  signPartial,
  signCreate,
  sha256,
});
