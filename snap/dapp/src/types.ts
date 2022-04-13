import { StreamTransport, SinkTransport } from "@metamask/mpc-client";

export type Transport = {
  stream: StreamTransport;
  sink: SinkTransport;
};
