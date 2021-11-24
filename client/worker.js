import('ecdsa-wasm')
  // Now we have the WASM methods available
  .then((wasm) => {
    let messageId = 0;
    let MESSAGE_REQUESTS = new Map();

    // Set up a connection to the backend server
    const ws = new WebSocket("ws://localhost:3030/demo");
    ws.onopen = () => {
      request({kind: "parameters"})
        .then((res) => {
          if (res.kind === "parameters") {
            postMessage({type: 'ready'});
          }
        });
    }

    ws.onmessage = (e) => {
      const res = JSON.parse(e.data);
      console.log("Websocket got message", res, res.id);
      if (res.id && MESSAGE_REQUESTS.has(res.id)) {
        const {resolve, reject} = MESSAGE_REQUESTS.get(res.id);
        resolve(res);
      }
    }

    function request(message) {
      const id = ++messageId;
      const resolve = (kind, data) => {
        console.log("message promise resolved...", kind, data);
        return data;
      };
      const reject = (e) => {
        console.error("message promise rejected...", e);
      };
      const p = new Promise(function (resolve, reject) {
        MESSAGE_REQUESTS.set(id, {resolve, reject});
      });
      message.id = id;
      ws.send(JSON.stringify(message));
      return p;
    }

  })
  .catch(e => console.error('Error importing wasm module `ecdsa-wasm`:', e));
