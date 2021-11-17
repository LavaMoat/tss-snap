import Worker from 'worker-loader!./worker.js';

if (window.Worker) {
  const worker = new Worker('worker.js');
  console.log('main is running with web worker support');

  worker.onmessage = (e) => {
    if (e.data.type === 'ready') {
      console.log('got ready event from web worker');
    }
  }

} else {
  console.log('Your browser doesn\'t support web workers.');
}
