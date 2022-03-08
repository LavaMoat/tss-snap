import React, { createContext, PropsWithChildren } from "react";
import { WebSocketClient } from "./mpc/clients/websocket";

const WebSocketContext = createContext(null);
export { WebSocketContext };

type WebSocketProviderProps = PropsWithChildren<Record<string, unknown>>;

// WARN: Must create the client outside of the WebSocketProvider
// WARN: component render function otherwise multiple websockets
// WARN: may be created.
const websocket = new WebSocketClient();
websocket.connect(`__URL__`);

const WebSocketProvider = (props: WebSocketProviderProps) => {
  return (
    <WebSocketContext.Provider value={websocket}>
      {props.children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;
