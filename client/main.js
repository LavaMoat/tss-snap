import Worker from "worker-loader!./worker.js";

if (window.Worker) {
  // DOM references
  const partiesLabel = document.querySelector(".parties span");
  const thresholdLabel = document.querySelector(".threshold span");
  const keygenSignupInfo = document.querySelector(".keygen-signup-info span");
  const keygenSignupButton = document.querySelector("button.keygen-signup");

  // Worker communication.
  //
  // The worker manages calls to WASM so it does not block the main
  // UI thread and holds the handle to the websocket for communication
  // with the server that maintains state and orchestrates communication
  // between the connected clients.
  const worker = new Worker("worker.js");
  worker.onmessage = (e) => {
    const { type } = e.data;

    switch (type) {
      case "server":
        const { server } = e.data;
        document.querySelector(".server span").innerText = server;
        break;
      // Worker has been initialized and is ready with the server parameters
      case "ready":
        const { parties, threshold } = e.data;
        partiesLabel.innerText = parties;
        thresholdLabel.innerText = threshold;
        keygenSignupButton.removeAttribute("hidden");
        keygenSignupButton.addEventListener("click", () => {
          worker.postMessage({ type: "keygen_signup" });
        });
        break;
      // Keygen signup is done, we have PartySignup and Round1Entry
      case "party_signup":
        keygenSignupButton.setAttribute("hidden", "1");
        const { party_signup } = e.data;
        keygenSignupInfo.innerText = JSON.stringify(party_signup);
        break;
    }
  };
} else {
  console.log("Your browser doesn't support web workers.");
}
