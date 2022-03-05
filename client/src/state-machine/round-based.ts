import { EventEmitter } from "events";
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

export interface StateMachine<R> {
  rounds: Round[];
  currentRound: number;
  totalRounds: number;
  start(): Promise<R>;
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
    console.log("Sending websocket message", message);
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

export class WebSocketSink extends EventEmitter {
  websocket: WebSocketClient;
  rounds: Map<number, Message[]>;
  expected: number;

  constructor(websocket: WebSocketClient, expected: number) {
    super();
    this.websocket = websocket;
    this.rounds = new Map();
    this.expected = expected;
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

  receiveMessage(entry: Message): void {
    const { round } = entry;

    if (this.rounds.get(round) === undefined) {
      this.rounds.set(round, []);
    }

    if (this.isReady(round)) {
      throw new Error("Received too many messages for round: " + round);
    }

    const answers = this.rounds.get(round);
    answers.push(entry);
    if (this.isReady(round)) {
      this.emit("ready", round);
    }
  }
}

export class RoundBased<R> extends EventEmitter {
  rounds: Round[];
  finalize: (messages: Message[]) => Promise<R>;
  currentRound: number;
  totalRounds: number;
  stream: StreamTransport;
  sink: SinkTransport;

  constructor(
    rounds: Round[],
    finalize: (messages: Message[]) => Promise<R>,
    stream: StreamTransport,
    sink: SinkTransport
  ) {
    super();
    this.rounds = rounds;
    this.finalize = finalize;
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
    this.emit("transitionEnter", this.currentRound, previousRound, round);

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
    //return new Promise(async (resolve) => {

    console.log("Total rounds", this.totalRounds);

    let nextMessages: Message[] = [];
    while (this.currentRound < this.totalRounds) {
      nextMessages = await this.nextRound(nextMessages);
      console.log("After round", this.currentRound, nextMessages);
    }
    console.log("All rounds completed, finalize with", nextMessages);

    return this.finalize(nextMessages);

    //await nextRound();

    /*
      const round = this.rounds[this.current];
      if (round) {
        const result = await round.transition();
        console.log("Got result for round", result);
        if (result) {
          const [round, messages] = result;
          for (const message of messages) {
            await this.stream.sendMessage(message);
          }
          console.log("Finished sending all messages for the round...");

          const nextMessages = await this.waitForRound(round);

          console.log("Got messages for next round", nextMessages);

        } else {
          throw new Error("Did not get result from round transition");
        }
      }
      */
    //})
  }
}
