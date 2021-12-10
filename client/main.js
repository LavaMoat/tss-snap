if (window.Worker) {
  // DOM references
  const clientLabel = document.querySelector(".client span");
  const partiesLabel = document.querySelector(".parties span");
  const thresholdLabel = document.querySelector(".threshold span");
  const partyNumber = document.querySelector(".party-number span");
  const keygenSignupButton = document.querySelector("button.keygen-signup");

  // Worker communication.
  //
  // The worker manages calls to WASM so it does not block the main
  // UI thread and holds the handle to the websocket for communication
  // with the server that maintains state and orchestrates communication
  // between the connected clients.
  const worker = new Worker(new URL("./worker.js", import.meta.url));
  worker.onmessage = (e) => {
    const { type } = e.data;

    switch (type) {
      // Worker sends us the backend server URL
      case "server":
        const { server } = e.data;
        document.querySelector(".server span").innerText = server;
        break;
      // Worker has been initialized and is ready with the server parameters
      case "ready":
        const { conn_id, parties, threshold } = e.data;
        clientLabel.innerText = "#" + conn_id;
        partiesLabel.innerText = parties;
        thresholdLabel.innerText = threshold;
        keygenSignupButton.removeAttribute("hidden");
        keygenSignupButton.addEventListener("click", () => {
          worker.postMessage({ type: "party_signup" });
        });
        break;
      // We have PartySignup
      case "party_signup":
        keygenSignupButton.setAttribute("hidden", "1");
        const { partySignup } = e.data;
        partyNumber.innerText = partySignup.number;
        break;
      // We have Round1Entry
      case "round1_complete":
        console.log("keygen: round 1 complete");
        break;
      // We have Round2Entry
      case "round2_complete":
        console.log("keygen: round 2 complete");
        break;
      // We have Round3Entry
      case "round3_complete":
        console.log("keygen: round 3 complete");
      // We have Round4Entry
      case "round4_complete":
        console.log("keygen: round 4 complete");
        break;
      // We have Round5Entry
      case "round5_complete":
        console.log("keygen: round 5 complete");
        break;
      // We have all the key information for this party
      case "keygen_complete":
        console.log("keygen: completed!");
        break;
    }
  };
} else {
  console.log("Your browser doesn't support web workers.");
}
