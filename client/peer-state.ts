// PeerEntry is sent by the server when relaying messages
// peer to peer.
export interface PeerEntry {
  party_from: number;
  party_to: number;
  value: string;
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

export type PeerEntryHandler = (entry: PeerEntry) => string[] | null;

export const makePeerState = (expected: number): PeerEntryHandler => {
  let received: PeerEntry[] = [];
  return (entry: PeerEntry) => {
    received.push(entry);
    if (received.length === expected) {
      const values = getSortedPeerEntriesAnswer(received);
      received = [];
      return values;
    }
    return null;
  };
};
