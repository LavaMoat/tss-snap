import React, { useState, useContext, useEffect } from "react";
import * as ReactDOMClient from 'react-dom/client';

const root = ReactDOMClient.createRoot(document.querySelector("main"));
root.render(
  <React.StrictMode>
    <p>Rendering...</p>
  </React.StrictMode>
);
