import { StateMachine, TransitionHandler } from "./machine";
import { KeyShare, SessionInfo, SignMessage, Phase } from ".";
import { MessageCache, Message } from "./message-cache";
import { waitFor } from "./wait-for";
import { WebSocketClient } from "../websocket";

export type SignTransition = Message[];
export type SignState = boolean;

export async function signMessage(
  websocket: WebSocketClient,
  worker: any,
  onTransition: TransitionHandler<SignState, SignTransition>,
  info: SessionInfo,
  keyShare: KeyShare,
  message: string
): Promise<SignMessage> {
  const incomingMessageCache = new MessageCache(info.parameters.threshold);
  const wait = waitFor<SignState, SignTransition>(Phase.SIGN);

  function makeStandardTransition(
    machine: StateMachine<SignState, SignTransition>
  ) {
    return async function standardTransition(
      previousState: SignState,
      transitionData: SignTransition
    ): Promise<SignState | null> {
      const incoming = transitionData as Message[];
      for (const message of incoming) {
        console.info("Sign handle incoming", message);
        await worker.signHandleIncoming(message);
      }

      const proceed = async () => {
        const result = await worker.signProceed();
        if (result) {
          const [round, messages] = result;
          wait(websocket, info, machine, incomingMessageCache, round, messages);
        } else {
          // SEE: https://github.com/LavaMoat/ecdsa-wasm/issues/45
          throw new Error("Sign proceed did not generate any messages");
        }
      };

      await proceed();

      return true;
    };
  }

  return new Promise(async (resolve) => {
    const machine = new StateMachine<SignState, SignTransition>([]);
    machine.states = [
      {
        name: "SIGN_ROUND_0",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const index = keyShare.localKey.i;

          const round = 0;

          // Must share our key share index
          // in order to initialize the state
          // machine with list of participants.
          const indexMessage: Message = {
            round,
            sender: index,
            receiver: null,
            body: info.partySignup.number,
          };

          wait(websocket, info, machine, incomingMessageCache, round, [
            indexMessage,
          ]);
          return true;
        },
      },
      {
        name: "SIGN_ROUND_1",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const incoming = transitionData as Message[];
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

          const keyShareParticipants = participants.map((item) => item[0]);
          // Initialize the WASM state machine
          await worker.signInit(
            info.partySignup.number,
            keyShareParticipants,
            keyShare.localKey
          );

          const [round, messages] = await worker.signProceed();
          wait(websocket, info, machine, incomingMessageCache, round, messages);
          return true;
        },
      },
      {
        name: "SIGN_ROUND_2",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_3",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_4",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_5",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_6",
        transition: makeStandardTransition(machine),
      },
      {
        name: "SIGN_ROUND_7",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const incoming = transitionData as Message[];
          for (const message of incoming) {
            await worker.signHandleIncoming(message);
          }
          await worker.signProceed();
          // Prepare to sign partial but must allow the
          // transition function to return first!
          setTimeout(() => machine.next(), 0);
          return true;
        },
      },
      {
        name: "SIGN_ROUND_8",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const partial = await worker.signPartial(message);
          const round = 8;
          // Broadcast the partial signature
          // to other clients
          const partialMessage: Message = {
            round,
            sender: info.partySignup.number,
            receiver: null,
            body: partial,
          };
          wait(websocket, info, machine, incomingMessageCache, round, [
            partialMessage,
          ]);
          return true;
        },
      },
      {
        name: "SIGN_FINALIZE",
        transition: async (
          previousState: SignState,
          transitionData: SignTransition
        ): Promise<SignState | null> => {
          const incoming = transitionData as Message[];
          const partials = incoming.map((msg) => msg.body);
          const signResult = await worker.signCreate(partials);
          websocket.removeAllListeners("sessionMessage");
          machine.removeAllListeners("transitionEnter");
          resolve(signResult);
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
}
