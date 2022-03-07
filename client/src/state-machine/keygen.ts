import { KeyShare, SessionInfo } from ".";
import { WebSocketClient } from "../websocket";
import { EcdsaWorker } from "../worker";

import {
  Message,
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
  await worker.keygenInit(info.parameters, info.partySignup);

  const standardTransition = async (
    incoming: Message[]
  ): Promise<[number, Message[]]> => {
    for (const message of incoming) {
      await worker.keygenHandleIncoming(message);
    }
    return await worker.keygenProceed();
  };

  const rounds: Round[] = [
    {
      name: "KEYGEN_ROUND_1",
      transition: async (): Promise<[number, Message[]]> => {
        return await worker.keygenProceed();
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
      const keyShare: KeyShare = await worker.keygenCreate();
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
