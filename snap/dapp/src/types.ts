import {
  KeyShare,
  StreamTransport,
  SinkTransport,
  SignResult,
} from "@metamask/mpc-client";

import { UnsignedTransaction } from "ethers";

// Key share with a human-friendly label.
export type NamedKeyShare = {
  label: string;
  share: KeyShare;
};

export type SignProof = {
  signature: SignResult;
  address: string;
  value: SignValue;
  timestamp: number;
};

// Maps message signing proofs from key address.
export type MessageProofs = {
  [key: string]: SignProof[];
};

// Application state that can be persisted to disc by the snap backend.
export type AppState = {
  keyShares: NamedKeyShare[];
  messageProofs: MessageProofs;
};

// Message to be signed.
export type SignMessage = {
  message: string;
  digest: Uint8Array;
};

export enum SigningType {
  MESSAGE = "message",
  TRANSACTION = "transaction",
}

// Type for signing transactions
export type SignTransaction = {
  transaction: UnsignedTransaction;
  digest: Uint8Array;
};

export type SignValue = SignMessage | SignTransaction;

/// TODO: expose this from the client package
export type Transport = {
  stream: StreamTransport;
  sink: SinkTransport;
};
