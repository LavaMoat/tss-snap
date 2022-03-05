import { KeyShare, SessionInfo, Phase } from ".";
import { WebSocketClient } from "../websocket";

import {
  Message,
  Round,
  RoundBased,
  WebSocketStream,
  WebSocketSink,
  onTransition,
} from "./round-based";

export async function generateKeyShare(
  websocket: WebSocketClient,
  worker: any,
  info: SessionInfo
): Promise<KeyShare> {
  // Initialize the WASM state machine
  await worker.keygenInit(info.parameters, info.partySignup);

  const stream = new WebSocketStream(
    websocket,
    info.groupId,
    info.sessionId,
    Phase.KEYGEN
  );

  const sink = new WebSocketSink(websocket, info.parameters.parties - 1);

  const standardTransition = async (
    incoming: Message[]
  ): Promise<[number, Message[]] | null> => {
    for (const message of incoming) {
      await worker.keygenHandleIncoming(message);
    }
    return await worker.keygenProceed();
  };

  const rounds: Round[] = [
    {
      name: "KEYGEN_ROUND_1",
      transition: async (
        incoming: Message[]
      ): Promise<[number, Message[]] | null> => {
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

  const finalize = async (incoming: Message[]) => {
    await standardTransition(incoming);
    const keyShare: KeyShare = await worker.keygenCreate();
    return keyShare;
  };

  const handler = new RoundBased<KeyShare>(
    rounds,
    finalize,
    onTransition,
    stream,
    sink
  );
  return handler.start();
}
