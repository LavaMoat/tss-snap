import("ecdsa-wasm")
  // Now we have the WASM methods available
  .then((wasm) => {
    // Websocket state
    let messageId = 0;
    let messageRequests = new Map();
    const server = "ws://localhost:3030/demo";
    const ws = new WebSocket(server);

    const clientState = {
      partySignup: null,
      round1Entry: null,
    };

    // Receive messages sent to the worker
    onmessage = async (e) => {
      const { data } = e;
      if (data.type === "keygen_signup") {
        // Generate the party signup entry
        const signup = await request({ kind: "keygen_signup" });
        const { party_signup } = signup.data;

        clientState.partySignup = party_signup;

        // Create the round 1 key entry
        const round1_entry = wasm.generate_round1_entry(party_signup);
        const { entry } = round1_entry;

        clientState.round1Entry = round1_entry;

        // Broadcast the round entry to the server
        const signupEntry = await request({
          kind: "set_round1_entry",
          data: { entry, uuid: party_signup.uuid },
        });
        postMessage({ type: "party_signup", round1_entry, party_signup });
      }
    };

    // Handle messages from the server that were broadcast
    // without a client request
    const onBroadcastMessage = (msg) => {
      switch (msg.kind) {
        case "commitment_answer":
          console.log("got a commitment answer for ", msg.data.round);
          switch (msg.data.round) {
            // Got round 1 commitments of other parties
            case "round1":
              // Get round 2 entry using round 1 commitments
              const round2_entry = wasm.generate_round2_entry(
                clientState.partySignup,
                clientState.round1Entry,
                msg.data.answer
              );

              console.log("got round 2 entry!!!", round2_entry);
          }
          return true;
      }
      return false;
    };

    // Websocket communication with the server
    ws.onopen = async () => {
      postMessage({ type: "server", server });
      const res = await request({ kind: "parameters" });
      const { parties, threshold } = res.data;
      postMessage({ type: "ready", parties, threshold });
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
