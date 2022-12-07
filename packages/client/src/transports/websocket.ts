import { Message, SessionKind } from '..';
import { WebSocketClient } from '../clients/websocket';
import { StreamTransport, SinkTransport } from '../round-based';

// Stream for outgoing messages that send JSON-RPC
// via a websocket client.
export class WebSocketStream implements StreamTransport {
  websocket: WebSocketClient;

  groupId: string;

  sessionId: string;

  kind: SessionKind;

  constructor(
    websocket: WebSocketClient,
    groupId: string,
    sessionId: string,
    kind: SessionKind,
  ) {
    this.websocket = websocket;
    this.groupId = groupId;
    this.sessionId = sessionId;
    this.kind = kind;
  }

  async sendMessage(message: Message) {
    message.uuid = this.sessionId;
    // console.log("Sending websocket message", message.round, message);
    return this.websocket.rpc({
      method: 'Session.message',
      params: [this.groupId, this.sessionId, this.kind, message],
    });
  }
}

// Sink for incoming messages that listens for events
// on a websocket client.
export class WebSocketSink implements SinkTransport {
  websocket: WebSocketClient;

  rounds: Map<number, Message[]>;

  expected: number;

  sessionId: string;

  constructor(websocket: WebSocketClient, expected: number, sessionId: string) {
    this.websocket = websocket;
    this.expected = expected;
    this.sessionId = sessionId;
    this.rounds = new Map();

    // Sink consumers must remove this listener
    // when appropriate.
    this.websocket.on('sessionMessage', (incoming: Message) => {
      this.receiveMessage(incoming);
    });
  }

  isReady(round: number): boolean {
    const messages = this.rounds.get(round);
    if (messages) {
      return messages.length === this.expected;
    }
    return false;
  }

  take(round: number): Message[] {
    const values = this.rounds.get(round).slice(0);
    this.rounds.delete(round);
    return values;
  }

  receiveMessage(message: Message): void {
    const { round, uuid } = message;

    if (!uuid) {
      throw new Error('Message is missing session UUID');
    }

    if (uuid !== this.sessionId) {
      throw new Error('Message is for the wrong session, UUID mismatch');
    }

    // console.log("Received websocket message", message, this.expected);

    if (this.rounds.get(round) === undefined) {
      this.rounds.set(round, []);
    }

    if (this.isReady(round)) {
      throw new Error(`Received too many messages for round: ${round}`);
    }

    const answers = this.rounds.get(round);
    answers.push(message);
  }
}
