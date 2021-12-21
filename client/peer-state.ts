import { Entry } from "./machine-common";

// PeerEntry is sent by the server when relaying messages
// peer to peer during round 3 of key generation.
export interface PeerEntry {
  party_from: number;
  party_to: number;
  entry: Entry;
}

// Temporary state for caching peer entries during round 3
// of the key generation.
export interface PeerState {
  parties: number;
  received: PeerEntry[];
}

export function getSortedPeerEntriesAnswer(peerState: PeerState): string[] {
  // Must sort the entries otherwise the decryption
  // keys will not match the peer entries
  peerState.received.sort((a: PeerEntry, b: PeerEntry) => {
    if (a.party_from < b.party_from) return -1;
    if (a.party_from > b.party_from) return 1;
    return 0;
  });
  return peerState.received.map((peer: PeerEntry) => peer.entry.value);
}

export const makePeerState = (parties: number): PeerState => {
  return { parties, received: [] };
};
