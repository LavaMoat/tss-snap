import React, { useState, useContext, useEffect } from "react";
import ReactDOM from "react-dom";
import { HashRouter, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";

import Home from "./routes/home";
import Keygen from "./routes/keygen";
import Sign from "./routes/sign";

import store from "./store";

import WebSocketProvider, { WebSocketContext } from "./websocket-provider";
import WorkerProvider from "./worker-provider";

const NotFound = () => <h3>Page not found</h3>;

const App = () => {
  if (window.Worker) {
    // Keep connected state for automated tests
    // to determine when new tabs are connected
    const [connected, setConnected] = useState(false);
    const websocket = useContext(WebSocketContext);

    useEffect(() => {
      websocket.on("open", () => {
        setConnected(true);
      });

      websocket.on("close", () => {
        setConnected(false);
      });
    });

    return (
      <div className={connected ? "connected" : ""}>
        <h1>
          <a href="/">ECDSA WASM Demo</a>
        </h1>
        <p>Using the GG2020 protocol, signing initiated on (threshold + 1)</p>
        <hr />
        <WorkerProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/keygen/:uuid" element={<Keygen />} />
            <Route path="/sign/:address" element={<Sign />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </WorkerProvider>
      </div>
    );
  } else {
    return <p>Your browser does not support web workers.</p>;
  }
};

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <HashRouter>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </HashRouter>
    </Provider>
  </React.StrictMode>,
  document.querySelector("main")
);
