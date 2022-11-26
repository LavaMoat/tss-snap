import { Message, KeyShare, SessionInfo, EcdsaWorker, KeyGenerator } from '.';
import {
  Round,
  RoundBased,
  StreamTransport,
  SinkTransport,
  onTransition as onTransitionLog,
} from './round-based';

/**
 * Starts the round-based processing to generate a key share.
 *
 * @param worker - The worker implementation.
 * @param stream - The stream for sending messages.
 * @param sink - The sink for receiving messages.
 * @param info - The session information.
 * @param onTransition - Optional transition handler.
 */
export async function generateKeyShare(
  worker: EcdsaWorker,
  stream: StreamTransport,
  sink: SinkTransport,
  info: SessionInfo,
  onTransition?: (previousRound: string, current: string) => void,
): Promise<KeyShare> {
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/unbound-method */
  const keygen: KeyGenerator = await new (worker.KeyGenerator as any)(
    info.parameters,
    info.partySignup,
  );

  const doTransition = (previousRound: string, current: string) => {
    // Call standard onTransition for logs
    onTransitionLog(previousRound, current);
    // Call custom handler for UI progress updates
    if (onTransition) {
      onTransition(previousRound, current);
    }
  };

  const standardTransition = async (
    incoming: Message[],
  ): Promise<[number, Message[]]> => {
    for (const message of incoming) {
      /* eslint-disable @typescript-eslint/await-thenable */
      await keygen.handleIncoming(message);
    }
    return await keygen.proceed();
  };

  const rounds: Round[] = [
    {
      name: 'KEYGEN_ROUND_1',
      transition: async (): Promise<[number, Message[]]> => {
        return await keygen.proceed();
      },
    },
    {
      name: 'KEYGEN_ROUND_2',
      transition: standardTransition,
    },
    {
      name: 'KEYGEN_ROUND_3',
      transition: standardTransition,
    },
    {
      name: 'KEYGEN_ROUND_4',
      transition: standardTransition,
    },
  ];

  const finalizer = {
    name: 'KEYGEN_FINALIZE',
    finalize: async (incoming: Message[]) => {
      await standardTransition(incoming);
      return keygen.create();
    },
  };

  const handler = new RoundBased<KeyShare>(
    rounds,
    finalizer,
    doTransition,
    stream,
    sink,
  );
  return handler.start();
}
