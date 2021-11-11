import('ecdsa-wasm')
  .then((wasm) => {
    //postMessage({type: 'ready'});
  })
  .catch(e => console.error('Error importing wasm module `ecdsa-wasm`:', e));
