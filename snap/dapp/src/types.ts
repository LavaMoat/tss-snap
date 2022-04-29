import { StreamTransport, SinkTransport } from "@metamask/mpc-client";

// Message to be signed.
export type SignMessage = {
  message: string;
  digest: string;
}

// TODO: type for signing transactions
export type SignTransaction = null;

export type SignValue = SignMessage | SignTransaction;

export type Transport = {
  stream: StreamTransport;
  sink: SinkTransport;
};
