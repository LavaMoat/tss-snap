import { WebSocketClient } from "../websocket";
import { Phase } from "./index";

// Message is sent by the server when relaying messages.
//
// When receiver is null then the message is a broadcast round
// otherwise communication should be handled peer to peer.
export interface Message {
  round: number;
  sender: number;
  uuid: string;
  receiver?: number;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  body: any;
}

export interface Round {
  name: string;
  transition: (incoming?: Message[]) => Promise<[number, Message[]]>;
}

export interface Finalizer<R> {
  name: string;
  finalize: (incoming: Message[]) => Promise<R>;
}

export interface StreamTransport {
  sendMessage(message: Message): Promise<void>;
}

export class WebSocketStream {
  websocket: WebSocketClient;
  groupId: string;
  sessionId: string;
  phase: Phase;

  constructor(
    websocket: WebSocketClient,
    groupId: string,
    sessionId: string,
    phase: Phase
  ) {
    this.websocket = websocket;
    this.groupId = groupId;
    this.sessionId = sessionId;
    this.phase = phase;
  }

  async sendMessage(message: Message) {
    message.uuid = this.sessionId;
    //console.log("Sending websocket message", message.round, message);
    return this.websocket.rpc({
      method: "Session.message",
      params: [this.groupId, this.sessionId, this.phase, message],
    });
  }
}

export interface SinkTransport {
  receiveMessage(message: Message): void;
  isReady(round: number): boolean;
  take(round: number): Message[];
}

export class WebSocketSink {
  websocket: WebSocketClient;
  rounds: Map<number, Message[]>;
  expected: number;
  sessionId: string;

  constructor(websocket: WebSocketClient, expected: number, sessionId: string) {
    this.websocket = websocket;
    this.expected = expected;
    this.sessionId = sessionId;
    this.rounds = new Map();

    // Sink consumers must remove this listener
    // when appropriate.
    this.websocket.on("sessionMessage", (incoming: Message) => {
      this.receiveMessage(incoming);
    });
  }

  isReady(round: number): boolean {
    const messages = this.rounds.get(round);
    if (messages) {
      return messages.length === this.expected;
    }
    return false;
  }

  take(round: number): Message[] {
    const values = this.rounds.get(round).slice(0);
    this.rounds.delete(round);
    return values;
  }

  receiveMessage(message: Message): void {
    const { round, uuid } = message;

    if (!uuid) {
      throw new Error("Message is missing session UUID");
    }

    if (uuid !== this.sessionId) {
      throw new Error("Message is for the wrong session, UUID mismatch");
    }

    //console.log("Received websocket message", message);

    if (this.rounds.get(round) === undefined) {
      this.rounds.set(round, []);
    }

    if (this.isReady(round)) {
      throw new Error("Received too many messages for round: " + round);
    }

    const answers = this.rounds.get(round);
    answers.push(message);
  }
}

export class RoundBased<R> {
  rounds: Round[];
  finalizer: Finalizer<R>;
  onTransition: (previousRound: string, current: string) => void;
  currentRound: number;
  totalRounds: number;
  stream: StreamTransport;
  sink: SinkTransport;

  constructor(
    rounds: Round[],
    finalizer: Finalizer<R>,
    onTransition: (previousRound: string, current: string) => void,
    stream: StreamTransport,
    sink: SinkTransport
  ) {
    this.rounds = rounds;
    this.finalizer = finalizer;
    this.onTransition = onTransition;
    this.currentRound = 0;
    this.totalRounds = rounds.length;
    this.stream = stream;
    this.sink = sink;
  }

  waitForRound(round: number): Promise<Message[]> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.sink.isReady(round)) {
          clearInterval(interval);
          resolve(this.sink.take(round));
        }
      }, 50);
    });
  }

  async nextRound(previousMessages: Message[]): Promise<Message[]> {
    const round = this.rounds[this.currentRound];

    const previousRound = this.rounds[this.currentRound - 1];
    this.onTransition(previousRound ? previousRound.name : null, round.name);

    if (round) {
      const result = await round.transition(previousMessages);
      if (result) {
        const [round, messages] = result;
        for (const message of messages) {
          await this.stream.sendMessage(message);
        }
        const nextMessages = await this.waitForRound(round);
        this.currentRound++;
        return nextMessages;
      } else {
        throw new Error("Did not get result from round transition");
      }
    }
  }

  async start(): Promise<R> {
    let nextMessages: Message[] = null;
    while (this.currentRound < this.totalRounds) {
      nextMessages = await this.nextRound(nextMessages);
    }

    const previousRound = this.rounds[this.currentRound - 1];
    this.onTransition(
      previousRound ? previousRound.name : null,
      this.finalizer.name
    );

    return this.finalizer.finalize(nextMessages);
  }
}

export const onTransition = (previousRound: string, current: string) => {
  let message = "";
  if (previousRound) {
    message = `transition from ${previousRound} to ${current}`;
  } else {
    message = `transition to ${current}`;
  }
  console.info(message);
};
