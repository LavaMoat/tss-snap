import React, { useState } from "react";
import ReactDOM from "react-dom";

interface SignFormProps {
  onSubmit: (message: string) => void;
}

const SignForm = (props: SignFormProps) => {
  const [message, setMessage] = useState("");

  const onSignFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (message.trim() === "") {
      return alert("Please enter a message to sign");
    }

    props.onSubmit(message);
  };

  const onMessageChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setMessage(event.currentTarget.value);
  };

  return (
    <>
      <h3>Propose a message to sign</h3>
      <form onSubmit={onSignFormSubmit}>
        <textarea
          placeholder="Enter a message to sign"
          rows={8}
          name="message"
          onChange={onMessageChange}
          value={message}
        ></textarea>
        <input type="submit" name="Sign" value="Submit Proposal" />
      </form>
    </>
  );
};

interface SignProposalProps {
  signMessage: string;
  onSignMessage: (message: string) => void;
  signStatusMessage: string;
}

const SignProposal = (props: SignProposalProps) => {
  const signButtonVisible = props.signStatusMessage === "";

  const onSignMessage = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    props.onSignMessage(props.signMessage);
  };

  return (
    <>
      <h3>Message to sign!</h3>
      <pre>{props.signMessage}</pre>
      {signButtonVisible ? (
        <button onClick={onSignMessage}>Sign</button>
      ) : (
        <p>{props.signStatusMessage}</p>
      )}
    </>
  );
};

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

    const [keygenSignupVisible, setKeygenSignupVisible] = useState(false);

    const [signMessage, setSignMessage] = useState(null);
    const [signStatusMessage, setSignStatusMessage] = useState("");
    const [signFormVisible, setSignFormVisible] = useState(false);
    const [signProposalVisible, setSignProposalVisible] = useState(false);

    const onKeygenPartySignup = () => {
      worker.postMessage({ type: "party_signup" });
      setKeygenSignupVisible(false);
    };

    const onSignFormSubmit = (message: string) => {
      worker.postMessage({ type: "sign_proposal", message });
      setSignFormVisible(false);
    };

    const onSignMessage = (message: string) => {
      setSignStatusMessage("Waiting for sign threshold...");
      worker.postMessage({ type: "sign_message", message });
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
          setKeygenSignupVisible(true);
          break;
        case "party_signup":
          const { partySignup } = e.data;
          setPartyNumber(partySignup.number > 0 ? partySignup.number : "N/A");
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
          setSignFormVisible(true);
          console.log("[UI] keygen: completed!");
          break;
        case "sign_progress":
          console.log("UI got sign progress");
          setSignStatusMessage("Signing in progress...");
          break;
        case "sign_proposal":
          const { message } = e.data;
          setSignMessage(message);
          setSignFormVisible(false);
          setSignProposalVisible(true);
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
        {keygenSignupVisible ? (
          <button onClick={onKeygenPartySignup}>Keygen Signup</button>
        ) : null}
        {signFormVisible ? <SignForm onSubmit={onSignFormSubmit} /> : null}
        {signProposalVisible ? (
          <SignProposal
            signMessage={signMessage}
            signStatusMessage={signStatusMessage}
            onSignMessage={onSignMessage}
          />
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
