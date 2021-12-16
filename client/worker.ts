import init, { initThreadPool } from "ecdsa-wasm";
import { makeWebSocketClient, BroadcastMessage } from "./websocket-client";
import { PeerState, KeygenResult, Handshake } from "./machine-common";
import { makeKeygenStateMachine } from "./machine-keygen";
import { makeSignMessageStateMachine } from "./machine-sign";

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

const url = "ws://localhost:3030/demo";
const { send, request } = makeWebSocketClient({
  url,
  onOpen: async () => {
    postMessage({ type: "connected", url });
    const handshake = (await keygen.next()) as Handshake;
    postMessage({
      type: "ready",
      ...handshake.parameters,
      ...handshake.client,
    });
  },
  onClose: async () => {
    postMessage({ type: "disconnected" });
  },
  onBroadcastMessage,
});

let peerState: PeerState = { parties: 0, received: [] };
let keygenResult: KeygenResult = null;

const keygen = makeKeygenStateMachine(peerState, request, postMessage);
const sign = makeSignMessageStateMachine(peerState, request, postMessage, send);

// Receive messages sent to the worker
self.onmessage = async (e) => {
  const { data } = e;
  if (data.type === "party_signup") {
    await keygen.next();
  } else if (data.type === "sign_proposal") {
    const { message } = data;
    send({ kind: "sign_proposal", data: { message } });
  } else if (data.type === "sign_message") {
    const { message } = data;
    await sign.next({ message, keygenResult });
  }
};

// Handle messages from the server that were broadcast
// without a client request
async function onBroadcastMessage(msg: BroadcastMessage) {
  switch (msg.kind) {
    case "keygen_commitment_answer":
      switch (msg.data.round) {
        case "round1":
          await keygen.next({ answer: msg.data.answer });
          break;
        case "round2":
          await keygen.next({ answer: msg.data.answer });
          break;
        case "round4":
          await keygen.next({ answer: msg.data.answer });
          break;
        case "round5":
          keygenResult = (await keygen.next({
            answer: msg.data.answer,
          })) as KeygenResult;
          postMessage({ type: "keygen_complete" });
          break;
      }
      return true;
    case "keygen_peer_answer":
      const { peer_entry: keygenPeerEntry } = msg.data;
      peerState.received.push(keygenPeerEntry);

      // Got all the p2p answers
      if (peerState.received.length === peerState.parties - 1) {
        await keygen.next();
      }

      return true;
    case "sign_proposal":
      const { message } = msg.data;
      postMessage({ type: "sign_proposal", message });
      return true;
    case "sign_progress":
      // Parties that did not commit to signing should update the UI only
      postMessage({ type: "sign_progress" });

      // Parties not participating in the signing should reset their party number
      postMessage({
        type: "party_signup",
        partySignup: { number: 0, uuid: "" },
      });
      return true;
    case "sign_commitment_answer":
      switch (msg.data.round) {
        case "round0":
          // We performed a sign of the message and also need to update the UI
          postMessage({ type: "sign_progress" });
          await sign.next({ answer: msg.data.answer });
          break;
        case "round1":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round3":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round4":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round5":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round6":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round7":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round8":
          await sign.next({ answer: msg.data.answer });
          break;
        case "round9":
          await sign.next({ answer: msg.data.answer });
          break;
      }
      return true;
    case "sign_peer_answer":
      const { peer_entry: signPeerEntry } = msg.data;
      peerState.received.push(signPeerEntry);

      // Got all the p2p answers
      if (peerState.received.length === peerState.parties - 1) {
        await sign.next();
      }

      return true;
    case "sign_result":
      const { sign_result: signResult } = msg.data;
      // Update the UI
      postMessage({ type: "sign_result", signResult });
      return true;
  }
  return false;
}
