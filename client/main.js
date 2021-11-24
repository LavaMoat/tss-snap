import Worker from 'worker-loader!./worker.js';

if (window.Worker) {
  const worker = new Worker('worker.js');
  worker.onmessage = (e) => {
    const {type} = e.data;
    if (type === 'server') {
      const {server} = e.data;
      document.querySelector('.server span').innerText = server;
    } else if (type === 'ready') {
      const {parties, threshold} = e.data;
      document.querySelector('.parties span').innerText = parties;
      document.querySelector('.threshold span').innerText = threshold;

      console.log('got ready event from web worker', parties, threshold);
    }
  }

} else {
  console.log('Your browser doesn\'t support web workers.');
}
