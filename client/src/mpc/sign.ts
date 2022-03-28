import {
  Message,
  KeyShare,
  SessionInfo,
  SignMessage,
  PartySignup,
  EcdsaWorker,
  Signer,
} from ".";
import { WebSocketClient } from "./clients/websocket";
import { GroupInfo } from "../store/group";

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
  signer: Signer,
  stream: StreamTransport,
  sink: SinkTransport
): Promise<void> {
  const standardTransition = async (
    incoming: Message[]
  ): Promise<[number, Message[]]> => {
    for (const message of incoming) {
      await signer.handleIncoming(message);
    }
    return await signer.proceed();
  };

  const rounds: Round[] = [
    {
      name: "SIGN_ROUND_1",
      transition: async (): Promise<[number, Message[]]> => {
        return await signer.proceed();
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
  signer: Signer,
  info: SessionInfo,
  message: string,
  stream: StreamTransport,
  sink: SinkTransport
): Promise<SignMessage> {
  const rounds: Round[] = [
    {
      name: "SIGN_ROUND_8",
      transition: async (): Promise<[number, Message[]]> => {
        const partial = await signer.partial(message);
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
      return await signer.create(partials);
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

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const signer: Signer = await new (worker.Signer as any)(
    info.partySignup.number,
    participants,
    keyShare.localKey
  );

  await offlineStage(signer, stream, sink);

  const signed = await partialSignature(signer, info, message, stream, sink);
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
