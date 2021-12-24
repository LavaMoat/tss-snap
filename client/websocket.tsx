import { EventEmitter } from "events";
import React, { createContext, PropsWithChildren } from "react";

type BroadcastKind =
  | "party_signup"
  | "peer_relay"
  | "sign_proposal"
  | "sign_progress"
  | "sign_result";

export interface BroadcastMessage {
  kind: BroadcastKind;
  data: any;
}

type RequestKind =
  | "group_create"
  | "group_join"
  | "parameters"
  | "party_signup"
  | "peer_relay"
  | "sign_proposal"
  | "sign_result";

export interface RequestMessage {
  id?: number;
  kind: RequestKind;
  data?: any;
}

export interface ResponseMessage {
  id?: number;
  data?: any;
}

interface PromiseCache {
  resolve: (message: unknown) => void;
  reject: (reason: any) => void;
}

export class WebSocketClient extends EventEmitter {
  messageId: number;
  messageRequests: Map<number, PromiseCache>;
  websocket: WebSocket;

  constructor() {
    super();
    this.messageId = 0;
    this.messageRequests = new Map();
  }

  connect(url: string) {
    if (this.websocket) {
      this.websocket.close();
    }
    console.log("CONNECTING TO ", url);
    this.websocket = new WebSocket(url);
    this.websocket.onopen = (e) => {
      console.log("GOT OPEN EVENT", this.websocket.readyState);
      this.emit("open");
    };
    this.websocket.onclose = (e) => {
      this.emit("close");
    };
    this.websocket.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      // Got a promise to resolve
      if (msg.id && this.messageRequests.has(msg.id)) {
        const { resolve } = this.messageRequests.get(msg.id);
        resolve(msg);
        this.messageRequests.delete(msg.id);
      } else {
        console.log("GOT BROADCAST MESSAGE, EMIT AN EVENT");

        // Without an `id` we treat as a broadcast message that
        // was sent from the server without a request from the client
        /*
        if (!(await onBroadcastMessage(msg))) {
          console.error(
            "websocket client received a message it could not handle: ",
            msg
          );
        }
        */
      }
    };
  }

  // Send a message over the websocket as JSON
  send(message: RequestMessage): void {
    this.websocket.send(JSON.stringify(message));
  }

  // Wrap a websocket request in a promise that expects
  // a response from the server
  request(message: RequestMessage): Promise<ResponseMessage> {
    const id = ++this.messageId;
    const resolve = (data: ResponseMessage) => data;
    const reject = (e: Error) => {
      throw e;
    };
    const p = new Promise((resolve, reject) => {
      this.messageRequests.set(id, { resolve, reject });
    });
    message.id = id;
    this.send(message);
    return p;
  }
}

const WebSocketContext = createContext(null);
export { WebSocketContext };

type WebSocketProviderProps = PropsWithChildren<{}>;

const WebSocketProvider = (props: WebSocketProviderProps) => {
  const websocket = new WebSocketClient();
  websocket.connect(`__URL__`);
  return (
    <WebSocketContext.Provider value={websocket}>
      {props.children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;
