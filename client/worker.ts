import init, { initThreadPool } from "ecdsa-wasm";
import { makeWebSocketClient, BroadcastMessage } from "./websocket-client";
import { PeerState, KeygenResult, Handshake } from "./machine-common";
import { makeKeygenStateMachine } from "./machine-keygen";
import {
  makeSignMessageStateMachine,
  SignMessageMachineContainer,
} from "./machine-sign";

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

const sendUiMessage = self.postMessage;

const url = `__URL__`;
const { send: sendNetworkMessage, request: sendNetworkRequest } =
  makeWebSocketClient({
    url,
    onOpen: async () => {
      sendUiMessage({ type: "connected", url });
      const handshake = (await getKeygenHandshake()) as Handshake;
      sendUiMessage({
        type: "ready",
        ...handshake.parameters,
        ...handshake.client,
      });
    },
    onClose: async () => {
      sendUiMessage({ type: "disconnected" });
    },
    onBroadcastMessage,
  });

let peerState: PeerState = { parties: 0, received: [] };
let keygenResult: KeygenResult = null;

const keygenMachine = makeKeygenStateMachine(
  peerState,
  sendNetworkRequest,
  sendUiMessage,
  onKeygenResult
);
let signMachine: SignMessageMachineContainer;

// Receive messages sent to the worker from the ui
self.onmessage = async (e) => {
  const { data } = e;
  if (data.type === "party_signup") {
    await keygenMachine.machine.next();
  } else if (data.type === "sign_proposal") {
    const { message } = data;
    sendNetworkMessage({ kind: "sign_proposal", data: { message } });
  } else if (data.type === "sign_message") {
    const { message } = data;
    prepareSignMessageStateMachine();
    await signMachine.machine.next({ message, keygenResult });
  }
};

// Weapper for late binding of keygenMachine
async function getKeygenHandshake() {
  return await keygenMachine.machine.next();
}

// Handle messages from the server that were broadcast
// without a client request
async function onBroadcastMessage(msg: BroadcastMessage) {
  if (await keygenMachine.onBroadcastMessage(msg)) return true;

  if (!signMachine && msg.kind === "sign_proposal") {
    prepareSignMessageStateMachine();
  }

  if (await signMachine.onBroadcastMessage(msg)) return true;
  return false;
}

// get result out of keygen state machine
function onKeygenResult(result: KeygenResult) {
  keygenResult = result;
}

function prepareSignMessageStateMachine() {
  signMachine = makeSignMessageStateMachine(
    peerState,
    sendNetworkRequest,
    sendUiMessage,
    sendNetworkMessage
  );
}
