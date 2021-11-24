import('ecdsa-wasm')
  // Now we have the WASM methods available
  .then((wasm) => {
    let messageId = 0;
    let messageRequests = new Map();

    // Set up a connection to the backend server
    const server = "ws://localhost:3030/demo";
    const ws = new WebSocket(server);
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
      const resolve = (data) => {
        return data;
      };
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
