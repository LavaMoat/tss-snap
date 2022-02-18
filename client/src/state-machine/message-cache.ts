import { EventEmitter } from "events";

// Message is sent by the server when relaying messages
// peer to peer.
export interface Message {
  round: number;
  sender: number;
  receiver?: number;
  body: any;
}

export class MessageCache extends EventEmitter {
  rounds: Map<number, Message[]>;
  expected: number;

  constructor(expected: number) {
    super();
    this.rounds = new Map();
    this.expected = expected;
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

  add(entry: Message): void {
    const { round } = entry;

    if (this.rounds.get(round) === undefined) {
      this.rounds.set(round, []);
    }

    const answers = this.rounds.get(round);
    answers.push(entry);
    if (this.isReady(round)) {
      this.emit("ready", round);
    }
  }
}
