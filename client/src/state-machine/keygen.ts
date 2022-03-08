import { Message, KeyShare, SessionInfo } from ".";
import { WebSocketClient } from "../websocket";
import { EcdsaWorker, KeyGenerator } from "../worker";

import {
  Round,
  RoundBased,
  StreamTransport,
  SinkTransport,
  onTransition,
} from "./round-based";

export async function generateKeyShare(
  websocket: WebSocketClient,
  worker: EcdsaWorker,
  stream: StreamTransport,
  sink: SinkTransport,
  info: SessionInfo
): Promise<KeyShare> {
  // Initialize the WASM state machine
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const keygen: KeyGenerator = await new (worker.KeyGenerator as any)(
    info.parameters,
    info.partySignup
  );

  const standardTransition = async (
    incoming: Message[]
  ): Promise<[number, Message[]]> => {
    for (const message of incoming) {
      await keygen.handleIncoming(message);
    }
    return await keygen.proceed();
  };

  const rounds: Round[] = [
    {
      name: "KEYGEN_ROUND_1",
      transition: async (): Promise<[number, Message[]]> => {
        return await keygen.proceed();
      },
    },
    {
      name: "KEYGEN_ROUND_2",
      transition: standardTransition,
    },
    {
      name: "KEYGEN_ROUND_3",
      transition: standardTransition,
    },
    {
      name: "KEYGEN_ROUND_4",
      transition: standardTransition,
    },
  ];

  const finalizer = {
    name: "KEYGEN_FINALIZE",
    finalize: async (incoming: Message[]) => {
      await standardTransition(incoming);
      const keyShare: KeyShare = await keygen.create();
      return keyShare;
    },
  };

  const handler = new RoundBased<KeyShare>(
    rounds,
    finalizer,
    onTransition,
    stream,
    sink
  );
  return handler.start();
}
