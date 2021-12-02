import("ecdsa-wasm")
  // Now we have the WASM methods available
  .then((wasm) => {
    // Websocket state
    let messageId = 0;
    let messageRequests = new Map();
    const server = "ws://localhost:3030/demo";
    const ws = new WebSocket(server);

    // Receive messages sent to the worker
    onmessage = async (e) => {
      const { data } = e;
      if (data.type === "keygen_signup") {
        // Generate the party signup entry
        const signup = await request({ kind: "keygen_signup" });
        const { party_signup } = signup.data;

        // Create the round 1 key entry
        const round_entry = wasm.keygen_signup_entry(party_signup);
        const { entry } = round_entry;

        // Broadcast the round entry to the server
        const signupEntry = await request({
          kind: "keygen_signup_entry",
          data: { entry, uuid: party_signup.uuid },
        });
        postMessage({ type: "keygen_signup_done", round_entry, party_signup });
      }
    };

    // Handle messages from the server that were broadcast
    // without a client request
    const onBroadcastMessage = (msg) => {
      switch (msg.kind) {
        case "commitment_answer":
          console.log("got a commitment answer for ", msg.data.round);
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
