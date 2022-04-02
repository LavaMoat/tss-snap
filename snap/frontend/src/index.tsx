import React from "react";
import * as ReactDOMClient from 'react-dom/client';

import App from './app';

type RpcRequest = {
  method: string;
  params?: any;
}

type SnapEthereum = {
  request: (req: RpcRequest) => Promise<unknown>;
}

declare global {
  const ethereum: SnapEthereum;
}

const root = ReactDOMClient.createRoot(document.querySelector("main"));
root.render(
  <App />
);
