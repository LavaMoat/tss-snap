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
            request({kind: "keygen_signup_entry", data: {entry}})
              .then((res) => {
                console.log('GOT KEYGEN SIGNUP RESPONSE');
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
          if (res.kind === "parameters") {
            const {parties, threshold} = res.data;
            postMessage({type: 'ready', parties, threshold});
          }
        });
    }

    ws.onmessage = (e) => {
      const res = JSON.parse(e.data);
      if (res.id && messageRequests.has(res.id)) {
        const {resolve} = messageRequests.get(res.id);
        resolve(res);
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
