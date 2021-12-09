import init, { initThreadPool } from "ecdsa-wasm";

// Temporary hack for getRandomValues() error
const getRandomValues = crypto.getRandomValues;
crypto.getRandomValues = function (buffer) {
  const array = new Uint8Array(buffer);
  const value = getRandomValues.call(crypto, array);
  buffer.set(value);
  return buffer;
};

await init();
await initThreadPool(navigator.hardwareConcurrency);

import("ecdsa-wasm")
  // Now we have the WASM methods available
  .then((wasm) => {
    // Websocket state
    let messageId = 0;
    let messageRequests = new Map();
    const server = "ws://localhost:3030/demo";
    const ws = new WebSocket(server);

    let clientState = {
      parties: null,
      threshold: null,
      partySignup: null,
      round1Entry: null,
      round2Entry: null,
      round3PeerEntries: [],
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
        const round1_entry = wasm.generate_round1_entry(party_signup);

        const { entry } = round1_entry;
        clientState.round1Entry = round1_entry;
        sendRound1Entry();
      }
    };

    // Handle messages from the server that were broadcast
    // without a client request
    const onBroadcastMessage = (msg) => {
      switch (msg.kind) {
        case "commitment_answer":
          switch (msg.data.round) {
            // Got round 1 commitments of other parties
            case "round1":
              postMessage({ type: "round1_complete", ...clientState });

              // Get round 2 entry using round 1 commitments
              const round2_entry = wasm.generate_round2_entry(
                clientState.partySignup,
                clientState.round1Entry,
                msg.data.answer
              );
              clientState.round2Entry = round2_entry;
              sendRound2Entry();
              break;
            case "round2":
              postMessage({ type: "round2_complete", ...clientState });
              const round3_entry = wasm.generate_round3_entry(
                clientState.parties,
                clientState.threshold,
                clientState.partySignup,
                clientState.round2Entry,
                msg.data.answer
              );
              clientState.round3Entry = round3_entry;
              sendRound3Entry();
              break;
          }
          return true;
        case "peer_answer":
          console.log("got peer answer by relay", msg.data);
          const { peer_entry } = msg.data;
          clientState.round3PeerEntries.push(peer_entry);

          // Got all the p2p answers
          if (
            clientState.round3PeerEntries.length ===
            clientState.parties - 1
          ) {
            postMessage({ type: "round3_complete", ...clientState });

            const round3_ans_vec = clientState.round3PeerEntries.map(
              (peer) => peer.entry
            );

            // Clean up the peer entries
            clientState.round3PeerEntries = null;

            console.log("all p2p messages received", round3_ans_vec);

            const round4_entry = wasm.generate_round4_entry(
              clientState.parties,
              clientState.partySignup,
              clientState.round3Entry,
              round3_ans_vec
            );

            console.log("got round 4 entry", round4_entry);
          }

          return true;
      }
      return false;
    };

    // Send the round 1 entry to the server
    const sendRound1Entry = async () => {
      const { entry } = clientState.round1Entry;
      await request({
        kind: "set_round1_entry",
        data: { entry, uuid: clientState.partySignup.uuid },
      });
    };

    // Send the round 2 entry to the server
    const sendRound2Entry = async () => {
      const { entry } = clientState.round2Entry;
      await request({
        kind: "set_round2_entry",
        data: { entry, uuid: clientState.partySignup.uuid },
      });
    };

    // Send the round 3 entry to the server
    const sendRound3Entry = async () => {
      const { peer_entries } = clientState.round3Entry;
      await request({
        kind: "relay_round3",
        data: { entries: peer_entries },
      });
    };

    // Websocket communication with the server
    ws.onopen = async () => {
      postMessage({ type: "server", server });
      const res = await request({ kind: "parameters" });
      clientState = { ...clientState, ...res.data };
      postMessage({ type: "ready", ...clientState });
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && messageRequests.has(msg.id)) {
        const { resolve } = messageRequests.get(msg.id);
        resolve(msg);
        // Without an `id` we treat as a broadcast message that
        // was sent from the server without a request from the client
      } else {
        if (!onBroadcastMessage(msg)) {
          console.error(
            "websocket client received a message it could not handle: ",
            msg
          );
        }
      }
    };

    // Wrap a websocket request in a promise that expects
    // a response from the server
    function request(message) {
      const id = ++messageId;
      const resolve = (data) => data;
      const reject = (e) => {};
      const p = new Promise(function (resolve, reject) {
        messageRequests.set(id, { resolve, reject });
      });
      message.id = id;
      ws.send(JSON.stringify(message));
      return p;
    }
  })
  .catch((e) => console.error("Error importing wasm module `ecdsa-wasm`:", e));
