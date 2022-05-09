import { StreamTransport, SinkTransport } from "@metamask/mpc-client";

// Message to be signed.
export type SignMessage = {
  message: string;
  digest: string;
};

export enum SigningType {
  MESSAGE = "message",
  TRANSACTION = "transaction",
}

// TODO: type for signing transactions
export type SignTransaction = {
  // TODO: store the transaction information
  digest: string;
};

export type SignValue = SignMessage | SignTransaction;

/// TODO: expose this from the client package
export type Transport = {
  stream: StreamTransport;
  sink: SinkTransport;
};
