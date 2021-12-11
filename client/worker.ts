import init, {
  initThreadPool,
  keygenRound1,
  keygenRound2,
  keygenRound3,
  keygenRound4,
  keygenRound5,
  createKey,
} from "ecdsa-wasm";

import { makeWebSocketClient, BroadcastMessage } from "./websocket-client";

// Temporary hack for getRandomValues() error
const getRandomValues = crypto.getRandomValues;
crypto.getRandomValues = function <T extends ArrayBufferView | null>(
  array: T
): T {
  const buffer = new Uint8Array(array as unknown as Uint8Array);
  const value = getRandomValues.call(crypto, buffer);
  (array as unknown as Uint8Array).set(value);
  return array;
};

// For top-level await typescript wants `target` to be es2017
// but this generates a "too much recursion" runtime error so
// we avoid top-level await for now
void (async function () {
  await init();
  await initThreadPool(navigator.hardwareConcurrency);
})();

interface PartySignup {
  number: number;
  uuid: string;
}

interface Entry {
  key: String;
  value: String;
}

interface RoundEntry {
  entry: Entry;
  // Webassembly adds a bunch of temporary properties
  // to each round entry for further rounds but
  // these fields should not be accessed here
  // however we declare their presence in the type
  [x: string]: any;
}

interface PeerEntry {
  party_from: number;
  party_to: number;
  entry: Entry;
}

interface ClientState {
  parties: number;
  threshold: number;
  partySignup: PartySignup;
  round1Entry: RoundEntry;
  round2Entry: RoundEntry;
  round3Entry: RoundEntry;
  round3PeerEntries: PeerEntry[];
  round4Entry: RoundEntry;
  round5Entry: RoundEntry;
  partyKey: any;
}

let clientState: ClientState = {
  parties: null,
  threshold: null,
  partySignup: null,
  round1Entry: null,
  round2Entry: null,
  round3Entry: null,
  round3PeerEntries: [],
  round4Entry: null,
  round5Entry: null,
  partyKey: null,
};

// Receive messages sent to the worker
onmessage = async (e) => {
  const { data } = e;
  if (data.type === "party_signup") {
    // Generate the party signup entry
    const signup = await request({ kind: "party_signup" });
    const { party_signup } = signup.data;

    clientState.partySignup = party_signup;

    postMessage({ type: "party_signup", ...clientState });

    // Create the round 1 key entry
    const round1_entry = keygenRound1(party_signup);

    const { entry } = round1_entry;
    clientState.round1Entry = round1_entry;
    // Send the round 1 entry to the server
    await request({
      kind: "set_round1_entry",
      data: {
        entry: clientState.round1Entry.entry,
        uuid: clientState.partySignup.uuid,
      },
    });
  }
};

// Handle messages from the server that were broadcast
// without a client request
const onBroadcastMessage = async (msg: BroadcastMessage) => {
  switch (msg.kind) {
    case "commitment_answer":
      switch (msg.data.round) {
        // Got round 1 commitments of other parties
        case "round1":
          postMessage({ type: "round1_complete", ...clientState });

          // Get round 2 entry using round 1 commitments
          const round2_entry = keygenRound2(
            clientState.partySignup,
            clientState.round1Entry,
            msg.data.answer
          );
          clientState.round2Entry = round2_entry;

          // Send the round 2 entry to the server
          await request({
            kind: "set_round2_entry",
            data: {
              entry: clientState.round2Entry.entry,
              uuid: clientState.partySignup.uuid,
            },
          });
          break;
        case "round2":
          postMessage({ type: "round2_complete", ...clientState });

          const round3_entry = keygenRound3(
            clientState.parties,
            clientState.threshold,
            clientState.partySignup,
            clientState.round2Entry,
            msg.data.answer
          );
          clientState.round3Entry = round3_entry;

          // Send the round 3 entry to the server
          await request({
            kind: "relay_round3",
            data: { entries: clientState.round3Entry.peer_entries },
          });
          break;
        case "round4":
          postMessage({ type: "round4_complete", ...clientState });

          const round5_entry = keygenRound5(
            clientState.parties,
            clientState.threshold,
            clientState.partySignup,
            clientState.round4Entry,
            msg.data.answer
          );

          clientState.round5Entry = round5_entry;

          // Send the round 5 entry to the server
          await request({
            kind: "set_round5_entry",
            data: {
              entry: clientState.round5Entry.entry,
              uuid: clientState.partySignup.uuid,
            },
          });
          break;
        case "round5":
          postMessage({ type: "round5_complete", ...clientState });

          const party_key = createKey(
            clientState.parties,
            clientState.threshold,
            clientState.partySignup,
            clientState.round5Entry,
            msg.data.answer
          );

          clientState.partyKey = party_key;
          postMessage({ type: "keygen_complete", ...clientState });
          break;
      }
      return true;
    case "peer_answer":
      const { peer_entry } = msg.data;
      clientState.round3PeerEntries.push(peer_entry);

      // Got all the p2p answers
      if (clientState.round3PeerEntries.length === clientState.parties - 1) {
        postMessage({ type: "round3_complete", ...clientState });

        // Must sort the entries otherwise the decryption
        // keys will not match the peer entries
        clientState.round3PeerEntries.sort((a: PeerEntry, b: PeerEntry) => {
          if (a.party_from < b.party_from) return -1;
          if (a.party_from > b.party_from) return 1;
          return 0;
        });

        const round3_ans_vec = clientState.round3PeerEntries.map(
          (peer: PeerEntry) => peer.entry
        );

        // Clean up the peer entries
        clientState.round3PeerEntries = null;

        const round4_entry = keygenRound4(
          clientState.parties,
          clientState.partySignup,
          clientState.round3Entry,
          round3_ans_vec
        );

        clientState.round4Entry = round4_entry;

        // Send the round 4 entry to the server
        await request({
          kind: "set_round4_entry",
          data: {
            entry: clientState.round4Entry.entry,
            uuid: clientState.partySignup.uuid,
          },
        });
      }

      return true;
  }
  return false;
};

const url = "ws://localhost:3030/demo";
const { request } = makeWebSocketClient({
  url,
  onOpen: async () => {
    postMessage({ type: "server", url });
    const res = await request({ kind: "parameters" });
    clientState = { ...clientState, ...res.data };
    postMessage({ type: "ready", ...clientState });
  },
  onClose: async () => {},
  onBroadcastMessage,
});
