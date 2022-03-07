import { Message, KeyShare, SessionInfo, SignMessage, PartySignup } from ".";
import { WebSocketClient } from "../websocket";
import { GroupInfo } from "../store/group";
import { EcdsaWorker } from "../worker";

import {
  Round,
  RoundBased,
  StreamTransport,
  SinkTransport,
  onTransition,
} from "./round-based";

async function getParticipants(
  info: SessionInfo,
  keyShare: KeyShare,
  stream: StreamTransport,
  sink: SinkTransport
): Promise<number[]> {
  const rounds: Round[] = [
    {
      name: "SIGN_ROUND_0",
      transition: async (): Promise<[number, Message[]]> => {
        const index = keyShare.localKey.i;

        const round = 0;

        // Must share our key share index
        // in order to initialize the state
        // machine with list of participants.
        const indexMessage: Message = {
          round,
          uuid: info.sessionId,
          sender: index,
          receiver: null,
          body: info.partySignup.number,
        };

        return [round, [indexMessage]];
      },
    },
  ];

  const finalizer = {
    name: "SIGN_PARTICIPANTS",
    finalize: async (incoming: Message[]) => {
      const participants = incoming.map((msg) => [msg.sender, msg.body]);
      participants.push([keyShare.localKey.i, info.partySignup.number]);
      // NOTE: Must be sorted by party signup number to ensure
      // NOTE: the party signup indices correspond to the correct
      // NOTE: index for the local key. See `OfflineStage::new()` in
      // NOTE: `multi-party-ecdsa` for more information.
      participants.sort((a, b) => {
        if (a[1] < b[1]) {
          return -1;
        }
        if (a[1] > b[1]) {
          return 1;
        }
        return 0;
      });

      return participants.map((item) => item[0]);
    },
  };

  const handler = new RoundBased<number[]>(
    rounds,
    finalizer,
    onTransition,
    stream,
    sink
  );

  return handler.start();
}

async function offlineStage(
  worker: EcdsaWorker,
  stream: StreamTransport,
  sink: SinkTransport
): Promise<void> {
  const standardTransition = async (
    incoming: Message[]
  ): Promise<[number, Message[]]> => {
    for (const message of incoming) {
      await worker.signHandleIncoming(message);
    }
    return await worker.signProceed();
  };

  const rounds: Round[] = [
    {
      name: "SIGN_ROUND_1",
      transition: async (): Promise<[number, Message[]]> => {
        return await worker.signProceed();
      },
    },
    {
      name: "SIGN_ROUND_2",
      transition: standardTransition,
    },
    {
      name: "SIGN_ROUND_3",
      transition: standardTransition,
    },
    {
      name: "SIGN_ROUND_4",
      transition: standardTransition,
    },
    {
      name: "SIGN_ROUND_5",
      transition: standardTransition,
    },
    {
      name: "SIGN_ROUND_6",
      transition: standardTransition,
    },
  ];

  const finalizer = {
    name: "SIGN_OFFLINE_STAGE",
    finalize: async (incoming: Message[]): Promise<void> => {
      await standardTransition(incoming);
      return null;
    },
  };

  const handler = new RoundBased<void>(
    rounds,
    finalizer,
    onTransition,
    stream,
    sink
  );

  return handler.start();
}

async function partialSignature(
  worker: EcdsaWorker,
  info: SessionInfo,
  message: string,
  stream: StreamTransport,
  sink: SinkTransport
): Promise<SignMessage> {
  const rounds: Round[] = [
    {
      name: "SIGN_ROUND_8",
      transition: async (): Promise<[number, Message[]]> => {
        const partial = await worker.signPartial(message);
        const round = 8;
        // Broadcast the partial signature
        // to other clients
        const partialMessage: Message = {
          round,
          uuid: info.sessionId,
          sender: info.partySignup.number,
          receiver: null,
          body: partial,
        };

        return [round, [partialMessage]];
      },
    },
  ];

  const finalizer = {
    name: "SIGN_PARTIAL",
    finalize: async (incoming: Message[]) => {
      const partials = incoming.map((msg) => msg.body);
      return await worker.signCreate(partials);
    },
  };

  const handler = new RoundBased<SignMessage>(
    rounds,
    finalizer,
    onTransition,
    stream,
    sink
  );

  return handler.start();
}

async function signMessage(
  websocket: WebSocketClient,
  worker: EcdsaWorker,
  stream: StreamTransport,
  sink: SinkTransport,
  info: SessionInfo,
  keyShare: KeyShare,
  message: string
): Promise<SignMessage> {
  const participants = await getParticipants(info, keyShare, stream, sink);

  // Initialize the WASM state machine
  await worker.signInit(
    info.partySignup.number,
    participants,
    keyShare.localKey
  );

  await offlineStage(worker, stream, sink);

  const signed = await partialSignature(worker, info, message, stream, sink);
  websocket.removeAllListeners("sessionMessage");
  return signed;
}

export async function sign(
  websocket: WebSocketClient,
  worker: EcdsaWorker,
  stream: StreamTransport,
  sink: SinkTransport,
  message: string,
  keyShare: KeyShare,
  group: GroupInfo,
  partySignup: PartySignup
): Promise<SignMessage> {
  const sessionInfo = {
    groupId: group.uuid,
    sessionId: partySignup.uuid,
    parameters: group.params,
    partySignup,
  };

  const signedMessage = await signMessage(
    websocket,
    worker,
    stream,
    sink,
    sessionInfo,
    keyShare,
    message
  );

  return signedMessage;
}
