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

export interface RpcRequest {
  jsonrpc: string;
  id?: number;
  method: string;
  params?: any[];
}

export interface RpcResponse {
  jsonrpc: string;
  id?: number;
  result?: any;
  error?: RpcError;
}

export interface RpcError {
  code: number;
  message: string;
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
  connected: boolean;
  queue: RpcRequest[];

  constructor() {
    super();
    this.messageId = 0;
    this.messageRequests = new Map();
    this.connected = false;
    this.queue = [];
  }

  connect(url: string) {
    if (this.websocket) {
      this.websocket.close();
    }
    console.log("CONNECTING TO ", url);
    this.websocket = new WebSocket(url);
    this.websocket.onopen = (e) => {
      console.log("GOT OPEN EVENT", this.websocket.readyState);
      this.connected = true;

      // Some routes make requests before the connection
      // has been established
      while (this.queue.length > 0) {
        const message = this.queue.shift();
        this.notify(message);
      }

      this.emit("open");
    };
    this.websocket.onclose = (e) => {
      this.connected = false;
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
        // Without an `id` we treat as a broadcast message that
        // was sent from the server without a request from the client
        const { kind } = msg;
        this.emit(kind, msg);
      }
    };
  }

  notify(message: RpcRequest): void {
    if (!this.connected) {
      this.queue.push(message);
    } else {
      this.websocket.send(JSON.stringify(message));
    }
  }

  rpc(message: RpcRequest): Promise<any> {
    const id = ++this.messageId;
    const p = new Promise((_resolve, reject) => {
      const resolve = (response: RpcResponse) => {
        if (response.error) {
          return reject(new Error(response.error.message));
        }
        return _resolve(response.result);
      };
      this.messageRequests.set(id, { resolve, reject });
    });
    message.id = id;
    message.jsonrpc = "2.0";
    this.notify(message);
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
