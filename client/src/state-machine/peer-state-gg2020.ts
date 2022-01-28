import { EventEmitter } from "events";

// PeerEntry is sent by the server when relaying messages
// peer to peer.
export interface PeerEntry {
  sender: number;
  receiver?: number;
}

/*
export function getSortedPeerEntriesAnswer(received: PeerEntry[]): string[] {
  // Must sort the entries otherwise the decryption
  // keys will not match the peer entries
  received.sort((a: PeerEntry, b: PeerEntry) => {
    if (a.from < b.from) return -1;
    if (a.from > b.from) return 1;
    return 0;
  });
  return received.map((peer: PeerEntry) => peer.value);
}
*/

export class PeerEntryCache extends EventEmitter {
  answers: PeerEntry[];
  expected: number;

  constructor(expected: number) {
    super();
    this.answers = [];
    this.expected = expected;
  }

  isReady(): boolean {
    return this.answers.length === this.expected;
  }

  take(): PeerEntry[] {
    const values = this.answers.slice(0);
    //const values = getSortedPeerEntriesAnswer(this.answers);
    this.answers = [];
    return values;
  }

  add(entry: PeerEntry): void {
    this.answers.push(entry);
    if (this.isReady()) {
      this.emit("ready");
    }
  }
}
