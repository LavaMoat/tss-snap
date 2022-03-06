import { WebSocketClient } from "../websocket";
import { Phase } from "./index";

// Message is sent by the server when relaying messages.
//
// When receiver is null then the message is a broadcast round
// otherwise communication should be handled peer to peer.
export interface Message {
  round: number;
  sender: number;
  receiver?: number;
  body: any;
}

export interface Round {
  name: string;
  transition: (
    transitionData?: Message[]
  ) => Promise<[number, Message[]] | null>;
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
  finish(): void;
}

export class WebSocketSink {
  websocket: WebSocketClient;
  rounds: Map<number, Message[]>;
  expected: number;

  constructor(websocket: WebSocketClient, expected: number) {
    this.websocket = websocket;
    this.rounds = new Map();
    this.expected = expected;
    this.websocket.on("sessionMessage", (incoming: Message) => {
      this.receiveMessage(incoming);
    });
  }

  finish() {
    this.rounds = new Map();
    //this.websocket.removeAllListeners("sessionMessage");
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
    const { round } = message;

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
  finalize: (messages: Message[]) => Promise<R>;
  onTransition: (index: number, previousRound: Round, current: Round) => void;
  currentRound: number;
  totalRounds: number;
  stream: StreamTransport;
  sink: SinkTransport;

  constructor(
    rounds: Round[],
    finalize: (messages: Message[]) => Promise<R>,
    onTransition: (index: number, previousRound: Round, current: Round) => void,
    stream: StreamTransport,
    sink: SinkTransport
  ) {
    this.rounds = rounds;
    this.finalize = finalize;
    this.onTransition = onTransition;
    this.currentRound = 0;
    this.totalRounds = rounds.length;
    this.stream = stream;
    this.sink = sink;
  }

  waitForRound(round: number): Promise<Message[]> {
    return new Promise((resolve) => {
      let interval: any;
      const isReady = () => {
        if (this.sink.isReady(round)) {
          clearInterval(interval);
          resolve(this.sink.take(round));
        }
      };
      interval = setInterval(isReady, 250);
    });
  }

  async nextRound(previousMessages: Message[]): Promise<Message[]> {
    const round = this.rounds[this.currentRound];

    const previousRound = this.rounds[this.currentRound - 1];
    this.onTransition(this.currentRound, previousRound, round);

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
    this.sink.finish();
    return this.finalize(nextMessages);
  }
}

export const onTransition = (
  index: number,
  previousRound: Round,
  current: Round
) => {
  let message = "";
  if (previousRound) {
    message = `transition from ${previousRound.name} to ${current.name}`;
  } else {
    message = `transition to ${current.name}`;
  }
  console.info(message);
};
