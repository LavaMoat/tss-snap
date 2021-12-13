import React, { useState } from "react";
import ReactDOM from "react-dom";

interface AppProps {
  worker: Worker;
}

const App = (props: AppProps) => {
  const { worker } = props;
  if (worker) {
    const [url, setUrl] = useState(null);
    const [clientId, setClientId] = useState(null);
    const [parties, setParties] = useState(null);
    const [threshold, setThreshold] = useState(null);
    const [partyNumber, setPartyNumber] = useState(null);

    const [signupVisible, setSignupVisible] = useState(false);

    const doKeygenPartySignup = () => {
      worker.postMessage({ type: "party_signup" });
      setSignupVisible(false);
    };

    // Handle message from the worker
    worker.onmessage = (e) => {
      const { type } = e.data;
      switch (type) {
        // Worker sends us the backend server URL
        case "server":
          const { url } = e.data;
          setUrl(url);
          break;
        // Worker has been initialized and is ready with the server parameters
        case "ready":
          const { conn_id, parties, threshold } = e.data;
          setClientId(conn_id);
          setParties(parties);
          setThreshold(threshold);
          setSignupVisible(true);
          break;
        // We have PartySignup
        case "party_signup":
          const { partySignup } = e.data;
          setPartyNumber(partySignup.number);
          break;
        case "round1_complete":
          console.log("[UI] keygen: round 1 complete");
          break;
        case "round2_complete":
          console.log("[UI] keygen: round 2 complete");
          break;
        case "round3_complete":
          console.log("[UI] keygen: round 3 complete");
          break;
        case "round4_complete":
          console.log("[UI] keygen: round 4 complete");
          break;
        case "round5_complete":
          console.log("[UI] keygen: round 5 complete");
          break;
        // We have all the key information for this party
        case "keygen_complete":
          console.log("[UI] keygen: completed!");
          break;
      }
    };

    return (
      <>
        <h1>ECDSA WASM Demo</h1>
        <p>Server: {url}</p>
        <p>Client ID: {clientId}</p>
        <p>Parties: {parties}</p>
        <p>Threshold: {threshold}</p>
        <p>Party #: {partyNumber ? partyNumber : "-"}</p>
        {signupVisible ? (
          <button onClick={doKeygenPartySignup}>Keygen Signup</button>
        ) : null}
      </>
    );
  } else {
    return <p>Your browser does not support web workers.</p>;
  }
};

const worker = window.Worker
  ? new Worker(new URL("./worker.ts", import.meta.url))
  : null;
ReactDOM.render(
  <React.StrictMode>
    <App worker={worker} />
  </React.StrictMode>,
  document.querySelector("main")
);
