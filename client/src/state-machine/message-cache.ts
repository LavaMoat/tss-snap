import { EventEmitter } from "events";

// Message is sent by the server when relaying messages
// peer to peer.
export interface Message {
  sender: number;
  receiver?: number;
}

export class MessageCache extends EventEmitter {
  answers: Message[];
  expected: number;

  constructor(expected: number) {
    super();
    this.answers = [];
    this.expected = expected;
  }

  isReady(): boolean {
    return this.answers.length === this.expected;
  }

  take(): Message[] {
    const values = this.answers.slice(0);
    this.answers = [];
    return values;
  }

  add(entry: Message): void {
    this.answers.push(entry);
    if (this.isReady()) {
      this.emit("ready");
    }
  }
}
