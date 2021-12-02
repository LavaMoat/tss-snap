import('ecdsa-wasm')
  // Now we have the WASM methods available
  .then((wasm) => {

    // Websocket state
    let messageId = 0;
    let messageRequests = new Map();
    const server = "ws://localhost:3030/demo";
    const ws = new WebSocket(server);

    // Receive messages sent to the worker
    onmessage = (e) => {
      const {data} = e;
      if (data.type === 'keygen_signup') {
        request({kind: "keygen_signup"})
          .then((res) => {
            const {party_signup} = res.data;
            const round_entry = wasm.keygen_signup_entry(party_signup);
            const {entry} = round_entry;

            // Broadcast the round entry to the server
            request({kind: "keygen_signup_entry", data: {entry, uuid: party_signup.uuid}})
              .then((res) => {
                postMessage({type: 'keygen_signup_done',
                  round_entry, party_signup});
              });
          });
      }
    }

    // Websocket communication with the server
    ws.onopen = () => {
      postMessage({type: 'server', server});
      request({kind: "parameters"})
        .then((res) => {
          const {parties, threshold} = res.data;
          postMessage({type: 'ready', parties, threshold});
        });
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && messageRequests.has(msg.id)) {
        const {resolve} = messageRequests.get(msg.id);
        resolve(msg);
      // Without an `id` we treat as a broadcast message that
      // was sent from the server without a request from the client
      } else {
        if (msg.kind === 'commitment_answer') {
          console.log('got a commitment answer for ', msg.data.round);
        } else {
          console.error('websocket client received a message it could not handle: ', msg);
        }
      }
    }

    function request(message) {
      const id = ++messageId;
      const resolve = (data) => data;
      const reject = (e) => {};
      const p = new Promise(function (resolve, reject) {
        messageRequests.set(id, {resolve, reject});
      });
      message.id = id;
      ws.send(JSON.stringify(message));
      return p;
    }

  })
  .catch(e => console.error('Error importing wasm module `ecdsa-wasm`:', e));
