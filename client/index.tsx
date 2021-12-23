import React, { useState } from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Group from "./routes/group";

const App = () => {
  console.log("App is rendering...");

  if (window.Worker) {
    const worker = window.Worker
      ? new Worker(new URL("./worker.ts", import.meta.url))
      : null;

    const sendWorkerMessage = (...args: any) =>
      worker.postMessage.call(worker, ...args);

    return (
      <>
        <h1>ECDSA WASM Demo</h1>
        <p>Using the gg18 protocol, signing initiated on (threshold + 1)</p>
        <hr />
        <Routes>
          <Route
            path="/"
            element={<Group sendWorkerMessage={sendWorkerMessage} />}
          />
        </Routes>
      </>
    );
  } else {
    return <p>Your browser does not support web workers.</p>;
  }
};

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
  document.querySelector("main")
);
