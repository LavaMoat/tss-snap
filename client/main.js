import Worker from 'worker-loader!./worker.js';

if (window.Worker) {
  // DOM references
  const partiesLabel = document.querySelector('.parties span');
  const thresholdLabel = document.querySelector('.threshold span');
  const keygenSignupInfo = document.querySelector('.keygen-signup-info span');
  const keygenSignupButton = document.querySelector('button.keygen-signup');

  // Worker communication.
  //
  // The worker manages calls to WASM so it does not block the main
  // UI thread and holds the handle to the websocket for communication
  // with the server that maintains state and orchestrates communication
  // between the connected clients.
  const worker = new Worker('worker.js');
  worker.onmessage = (e) => {
    const {type} = e.data;
    // Initial handshake gets the server parameters
    if (type === 'server') {
      const {server} = e.data;
      document.querySelector('.server span').innerText = server;
    // Worker has been initialized and is ready
    } else if (type === 'ready') {
      const {parties, threshold} = e.data;
      partiesLabel.innerText = parties;
      thresholdLabel.innerText = threshold;
      keygenSignupButton.removeAttribute('hidden');
      keygenSignupButton.addEventListener('click', () => {
        worker.postMessage({type: 'keygen_signup'});
      })
    // Keygen signup is complete
    } else if (type === 'keygen_signup_done') {
      keygenSignupButton.setAttribute('hidden', '1');
      const {party_signup} = e.data;
      keygenSignupInfo.innerText = JSON.stringify(party_signup);
      console.log('main thread for worker keygen signup done', party_signup);
    }
  }

} else {
  console.log('Your browser doesn\'t support web workers.');
}
