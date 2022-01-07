import { EventEmitter } from "events";

// PeerEntry is sent by the server when relaying messages
// peer to peer.
export interface PeerEntry {
  party_from: number;
  party_to: number;
  value: string;
  round: string;
}

export function getSortedPeerEntriesAnswer(received: PeerEntry[]): string[] {
  // Must sort the entries otherwise the decryption
  // keys will not match the peer entries
  received.sort((a: PeerEntry, b: PeerEntry) => {
    if (a.party_from < b.party_from) return -1;
    if (a.party_from > b.party_from) return 1;
    return 0;
  });
  return received.map((peer: PeerEntry) => peer.value);
}

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

  take(): string[] {
    const values = getSortedPeerEntriesAnswer(this.answers);
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
