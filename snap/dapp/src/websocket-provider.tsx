import React, { createContext, PropsWithChildren, Component } from "react";
import { WebSocketClient } from "@lavamoat/mpc-client";

const WebSocketContext = createContext(null);

type WebSocketProviderProps = PropsWithChildren<Record<string, unknown>>;

// WARN: Must create the client outside of the WebSocketProvider
// WARN: component render function otherwise multiple websockets
// WARN: may be created.
const websocket = new WebSocketClient();
// NOTE: must use backticks as webpack uses variable replacement
websocket.connect(process.env.WS_URL || `ws://localhost:3030/mpc`);

const WebSocketProvider = (props: WebSocketProviderProps) => {
  return (
    <WebSocketContext.Provider value={websocket}>
      {props.children}
    </WebSocketContext.Provider>
  );
};

class ListenerCleanup extends Component {
  static contextType = WebSocketContext;

  componentWillUnmount() {
    const websocket = this.context as WebSocketClient;
    websocket.removeAllListeners("sessionCreate");
    websocket.removeAllListeners("sessionSignup");
    websocket.removeAllListeners("sessionLoad");
    websocket.removeAllListeners("sessionClosed");

    // Clean up listeners managed by the sink implementation too.
    websocket.removeAllListeners("sessionMessage");
  }

  render() {
    // NOTE: returning null here annoys the typescript typechecker
    return <></>;
  }
}

export { WebSocketContext, ListenerCleanup };
export default WebSocketProvider;
