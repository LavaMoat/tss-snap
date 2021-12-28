import "./polyfills";
import React, { useState } from "react";
import ReactDOM from "react-dom";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import { Provider, useDispatch } from "react-redux";

import Home from "./routes/home";
import Group from "./routes/group";

import store from "./store";
import { setGroup } from "./store/group";

import WebSocketProvider from "./websocket";

const App = () => {
  const dispatch = useDispatch();

  if (window.Worker) {
    const worker = window.Worker
      ? new Worker(new URL("./worker.ts", import.meta.url))
      : null;

    worker.onmessage = (e) => {
      const { type } = e.data;

      /*
      switch (type) {
        case "group_create":
          dispatch(setGroup(e.data.group));
          break;
      }
      */
    };

    const sendWorkerMessage = (...args: any) =>
      worker.postMessage.call(worker, ...args);

    return (
      <>
        <h1>
          <Link to="/">ECDSA WASM Demo</Link>
        </h1>
        <p>Using the gg18 protocol, signing initiated on (threshold + 1)</p>
        <hr />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/group/:uuid" element={<Group />} />
        </Routes>
      </>
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
