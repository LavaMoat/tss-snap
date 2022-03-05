//import { StateMachine, TransitionHandler } from "./machine";
import { KeyShare, SessionInfo, Phase } from ".";
//import { MessageCache, Message } from "./message-cache";
//import { waitFor } from "./wait-for";
import { WebSocketClient } from "../websocket";

import {
  Message,
  Round,
  RoundBased,
  WebSocketStream,
  WebSocketSink,
} from "./round-based";

export type KeygenTransition = Message[];
export type KeygenState = boolean;

export async function generateKeyShare(
  websocket: WebSocketClient,
  worker: any,
  //onTransition: TransitionHandler<KeygenState, KeygenTransition>,
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

  const expected = info.parameters.parties - 1;
  const sink = new WebSocketSink(websocket, expected);

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
      transition: async (
        incoming: Message[]
      ): Promise<[number, Message[]] | null> => {
        for (const message of incoming) {
          await worker.keygenHandleIncoming(message);
        }
        return await worker.keygenProceed();
      },
    },
    {
      name: "KEYGEN_ROUND_3",
      transition: async (
        incoming: Message[]
      ): Promise<[number, Message[]] | null> => {
        for (const message of incoming) {
          await worker.keygenHandleIncoming(message);
        }
        return await worker.keygenProceed();
      },
    },
    {
      name: "KEYGEN_ROUND_4",
      transition: async (
        incoming: Message[]
      ): Promise<[number, Message[]] | null> => {
        for (const message of incoming) {
          await worker.keygenHandleIncoming(message);
        }
        return await worker.keygenProceed();
      },
    },
  ];

  const finalize = async (incoming: Message[]) => {
    for (const message of incoming) {
      await worker.keygenHandleIncoming(message);
    }
    await worker.keygenProceed();
    const keyShare: KeyShare = await worker.keygenCreate();
    websocket.removeAllListeners("sessionMessage");
    console.log("Generated key share!!!");
    //machine.removeAllListeners("transitionEnter");
    //resolve(keyShare);
    return keyShare;
  };

  const handler = new RoundBased<KeyShare>(rounds, finalize, stream, sink);
  handler.on(
    "transitionEnter",
    (index: number, previousRound: Round, current: Round) => {
      let message = "";
      if (previousRound) {
        message = `transition ${index} from ${previousRound.name} to ${current.name}`;
      } else {
        message = `transition ${index} to ${current.name}`;
      }
      console.info(message);
    }
  );

  const keyShare = await handler.start();
  handler.removeAllListeners("transitionEnter");
  return keyShare;

  //return new Promise(async (resolve) => {

  //});

  /*
  const incomingMessageCache = new MessageCache(info.parameters.parties - 1);
  const wait = waitFor<KeygenState, KeygenTransition>(Phase.KEYGEN);

  // Initialize the WASM state machine
  await worker.keygenInit(info.parameters, info.partySignup);

  function makeStandardTransition(
    machine: StateMachine<KeygenState, KeygenTransition>
  ) {
    return async function standardTransition(
      previousState: KeygenState,
      transitionData: KeygenTransition
    ): Promise<KeygenState | null> {
      const incoming = transitionData as Message[];

      for (const message of incoming) {
        await worker.keygenHandleIncoming(message);
      }
      const [round, messages] = await worker.keygenProceed();
      wait(websocket, info, machine, incomingMessageCache, round, messages);
      return true;
    };
  }

  return new Promise(async (resolve) => {
    const machine = new StateMachine<KeygenState, KeygenTransition>([]);
    machine.states = [
      {
        name: "KEYGEN_ROUND_1",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const [round, messages] = await worker.keygenProceed();
          wait(websocket, info, machine, incomingMessageCache, round, messages);
          return true;
        },
      },
      {
        name: "KEYGEN_ROUND_2",
        transition: makeStandardTransition(machine),
      },
      {
        name: "KEYGEN_ROUND_3",
        transition: makeStandardTransition(machine),
      },
      {
        name: "KEYGEN_ROUND_4",
        transition: makeStandardTransition(machine),
      },
      {
        name: "KEYGEN_ROUND_5",
        transition: async (
          previousState: KeygenState,
          transitionData: KeygenTransition
        ): Promise<KeygenState | null> => {
          const incoming = transitionData as Message[];
          for (const message of incoming) {
            await worker.keygenHandleIncoming(message);
          }
          await worker.keygenProceed();
          const keyShare: KeyShare = await worker.keygenCreate();
          websocket.removeAllListeners("sessionMessage");
          machine.removeAllListeners("transitionEnter");
          resolve(keyShare);
          return null;
        },
      },
    ];

    websocket.on("sessionMessage", (incoming: Message) => {
      incomingMessageCache.add(incoming);
    });

    machine.on("transitionEnter", onTransition);

    // Start the state machine running
    await machine.next();
  });
  */
}
