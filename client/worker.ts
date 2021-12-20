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
  sendUiMessage
);
let signMachine: SignMessageMachineContainer;

// sha256 of "hello world"
const helloWorldHash =
  "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";

// Receive messages sent to the worker from the ui
self.onmessage = async (e) => {
  const { data } = e;
  if (data.type === "party_signup") {
    // request for keygen - perform keygen
    await performKeygen();
  } else if (data.type === "sign_proposal") {
    // proposal for message - forward to network
    const { message } = data;
    sendNetworkMessage({ kind: "sign_proposal", data: { message } });
  } else if (data.type === "sign_message") {
    // request to sign message - perform sign
    const { message } = data;
    await performSignature(message);
  }
};

async function performKeygen() {
  // start keygen
  await keygenMachine.machine.next();
  // get party number
  keygenResult = (await keygenMachine.machine
    .completionPromise) as KeygenResult;
  const {
    partySignup: { number: partyNumber },
    parameters: { threshold, parties },
  } = keygenResult;
  // wait a moment to make sure everyones compelted their last transition
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (partyNumber === 1) {
    sendNetworkMessage({
      kind: "sign_proposal",
      data: { message: helloWorldHash },
    });
  }
  // here is the auto approval of the sign
  // disabled because its timeout based
  // manual approval for now
  // await new Promise((resolve) => setTimeout(resolve, 1000));
  // // lowest numbered threshold of signers compute "hello world" sig
  // if (partyNumber <= (threshold + 1)) {
  //   const result = await performSignature(helloWorldHash);
  //   console.log("hello world result", result);
  // } else {
  //   console.log("hello world skip", partyNumber, parties - threshold);
  // }
}

async function performSignature(message: string) {
  // create signature machine
  prepareSignMessageStateMachine();
  // start signature process
  console.log("perform sig", keygenResult);
  await signMachine.machine.next({ message, keygenResult });
  // return signature results
  return await signMachine.machine.completionPromise;
}

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

function prepareSignMessageStateMachine() {
  signMachine = makeSignMessageStateMachine(
    peerState,
    sendNetworkRequest,
    sendUiMessage,
    sendNetworkMessage
  );
}
