/* eslint id-denylist: 0 */

import {
  Message,
  KeyShare,
  SessionInfo,
  SignMessage,
  PartySignup,
  EcdsaWorker,
  Signer,
  GroupInfo,
} from '.';
import { WebSocketClient } from './clients/websocket';
import {
  Round,
  RoundBased,
  StreamTransport,
  SinkTransport,
  onTransition as onTransitionLog,
} from './round-based';

/**
 * Get the participant's party signup index used when generating
 * the key share and distribute them to each party.
 *
 * This is required to be able to instantiate the webassembly
 * signing state machine correctly.
 *
 * @param info - The session information.
 * @param keyShare - The key share.
 * @param stream - The stream for sending messages.
 * @param sink - The sink for receiving messages.
 * @param onTransition - Transition handler.
 */
async function getParticipants(
  info: SessionInfo,
  keyShare: KeyShare,
  stream: StreamTransport,
  sink: SinkTransport,
  onTransition: (previousRound: string, current: string) => void,
): Promise<number[]> {
  const rounds: Round[] = [
    {
      name: 'SIGN_ROUND_0',
      /* eslint-disable @typescript-eslint/require-await */
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
    name: 'SIGN_PARTICIPANTS',
    /* eslint-disable @typescript-eslint/require-await */
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
    sink,
  );

  return handler.start();
}

/**
 * Proceed with the offline stage signing state machine until
 * we have partial signatures.
 *
 * @param signer - The signer implementation.
 * @param stream - The stream for sending messages.
 * @param sink - The sink for receiving messages.
 * @param onTransition - Transition handler.
 */
async function offlineStage(
  signer: Signer,
  stream: StreamTransport,
  sink: SinkTransport,
  onTransition: (previousRound: string, current: string) => void,
): Promise<void> {
  const standardTransition = async (
    incoming: Message[],
  ): Promise<[number, Message[]]> => {
    for (const message of incoming) {
      /* eslint-disable @typescript-eslint/await-thenable */
      await signer.handleIncoming(message);
    }
    return await signer.proceed();
  };

  const rounds: Round[] = [
    {
      name: 'SIGN_ROUND_1',
      transition: async (): Promise<[number, Message[]]> => {
        return await signer.proceed();
      },
    },
    {
      name: 'SIGN_ROUND_2',
      transition: standardTransition,
    },
    {
      name: 'SIGN_ROUND_3',
      transition: standardTransition,
    },
    {
      name: 'SIGN_ROUND_4',
      transition: standardTransition,
    },
    {
      name: 'SIGN_ROUND_5',
      transition: standardTransition,
    },
    {
      name: 'SIGN_ROUND_6',
      transition: standardTransition,
    },
  ];

  const finalizer = {
    name: 'SIGN_OFFLINE_STAGE',
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
    sink,
  );

  return handler.start();
}

/**
 * Process the partial signatures to generate a complete signature.
 *
 * @param signer - The signer implementation.
 * @param info - The session information.
 * @param message - The message that will be signed.
 * @param stream - The stream for sending messages.
 * @param sink - The sink for receiving messages.
 * @param onTransition - Transition handler.
 */
async function partialSignature(
  signer: Signer,
  info: SessionInfo,
  message: Uint8Array,
  stream: StreamTransport,
  sink: SinkTransport,
  onTransition: (previousRound: string, current: string) => void,
): Promise<SignMessage> {
  const rounds: Round[] = [
    {
      name: 'SIGN_ROUND_8',
      transition: async (): Promise<[number, Message[]]> => {
        const partial = await signer.partial(Array.from(message));
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
    name: 'SIGN_PARTIAL',
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
    sink,
  );

  return handler.start();
}

/**
 * Utility for performing each of the stages for signing messages.
 *
 * @param websocket - The websocket client.
 * @param worker - The worker implementation.
 * @param stream - The stream for sending messages.
 * @param sink - The sink for receiving messages.
 * @param info - The session information.
 * @param keyShare - The private key share.
 * @param message - The message to be signed.
 * @param onTransition - Transition handler.
 */
async function signMessage(
  websocket: WebSocketClient,
  worker: EcdsaWorker,
  stream: StreamTransport,
  sink: SinkTransport,
  info: SessionInfo,
  keyShare: KeyShare,
  message: Uint8Array,
  onTransition: (previousRound: string, current: string) => void,
): Promise<SignMessage> {
  const participants = await getParticipants(
    info,
    keyShare,
    stream,
    sink,
    onTransition,
  );

  const partyIndex = participants.indexOf(keyShare.localKey.i) + 1;

  // Register this participant with the correct index lookup.
  //
  // The server will resolve the party index to the issuer
  // party number and then to the connection identifier.
  await websocket.rpc({
      method: "Session.participant",
      params: [
        info.groupId,
        info.sessionId,
        partyIndex,
        info.partySignup.number,
      ],
  });

  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/unbound-method */
  const signer: Signer = await new (worker.Signer as any)(
    partyIndex,
    participants,
    keyShare.localKey,
  );

  await offlineStage(signer, stream, sink, onTransition);

  const signed = await partialSignature(
    signer,
    info,
    message,
    stream,
    sink,
    onTransition,
  );
  websocket.removeAllListeners('sessionMessage');
  return signed;
}

/**
 * Sign a message.
 *
 * @param websocket - The websocket client implementation.
 * @param worker - The worker implementation.
 * @param stream - The stream for sending messages.
 * @param sink - The sink for receiving messages.
 * @param message - The message to be signed; must be a pre-hashed 32 byte array.
 * @param keyShare - The private key share.
 * @param group - The group information.
 * @param partySignup - The party signup information for the session.
 * @param onTransition - Optional transition handler.
 */
export async function sign(
  websocket: WebSocketClient,
  worker: EcdsaWorker,
  stream: StreamTransport,
  sink: SinkTransport,
  message: Uint8Array,
  keyShare: KeyShare,
  group: GroupInfo,
  partySignup: PartySignup,
  onTransition?: (previousRound: string, current: string) => void,
): Promise<SignMessage> {
  const sessionInfo = {
    groupId: group.uuid,
    sessionId: partySignup.uuid,
    parameters: group.params,
    partySignup,
  };

  const doTransition = (previousRound: string, current: string) => {
    // Call standard onTransition for logs
    onTransitionLog(previousRound, current);
    // Call custom handler for UI progress updates
    if (onTransition) {
      onTransition(previousRound, current);
    }
  };

  const signedMessage = await signMessage(
    websocket,
    worker,
    stream,
    sink,
    sessionInfo,
    keyShare,
    message,
    doTransition,
  );

  return signedMessage;
}
