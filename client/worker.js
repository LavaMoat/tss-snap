import('ecdsa-wasm')
  // Now we have the WASM methods available
  .then((wasm) => {
    // Set up a connection to the backend server
    const ws = new WebSocket("ws://localhost:3030/demo");
    ws.onopen = () => {
      postMessage({type: 'ready'});
    }

  })
  .catch(e => console.error('Error importing wasm module `ecdsa-wasm`:', e));
