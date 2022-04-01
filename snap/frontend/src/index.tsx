import React, { useState, useContext, useEffect } from "react";
import * as ReactDOMClient from 'react-dom/client';

import App from './app';

const root = ReactDOMClient.createRoot(document.querySelector("main"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
