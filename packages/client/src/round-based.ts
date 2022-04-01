import { Message } from '.';

export type Round = {
  name: string;
  transition: (incoming?: Message[]) => Promise<[number, Message[]]>;
};

export type Finalizer<R> = {
  name: string;
  finalize: (incoming: Message[]) => Promise<R>;
};

export type StreamTransport = {
  sendMessage(message: Message): Promise<void>;
};

export type SinkTransport = {
  receiveMessage(message: Message): void;
  isReady(round: number): boolean;
  take(round: number): Message[];
};

export class RoundBased<R> {
  rounds: Round[];

  finalizer: Finalizer<R>;

  onTransition: (previousRound: string, current: string) => void;

  currentRound: number;

  totalRounds: number;

  stream: StreamTransport;

  sink: SinkTransport;

  constructor(
    rounds: Round[],
    finalizer: Finalizer<R>,
    onTransition: (previousRound: string, current: string) => void,
    stream: StreamTransport,
    sink: SinkTransport,
  ) {
    this.rounds = rounds;
    this.finalizer = finalizer;
    this.onTransition = onTransition;
    this.currentRound = 0;
    this.totalRounds = rounds.length;
    this.stream = stream;
    this.sink = sink;
  }

  waitForRound(round: number): Promise<Message[]> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.sink.isReady(round)) {
          clearInterval(interval);
          resolve(this.sink.take(round));
        }
      }, 50);
    });
  }

  async nextRound(previousMessages: Message[]): Promise<Message[]> {
    const currentRound = this.rounds[this.currentRound];

    const previousRound = this.rounds[this.currentRound - 1];
    this.onTransition(
      previousRound ? previousRound.name : null,
      currentRound.name,
    );

    if (currentRound) {
      const result = await currentRound.transition(previousMessages);
      if (result) {
        const [round, messages] = result;
        for (const message of messages) {
          await this.stream.sendMessage(message);
        }
        const nextMessages = await this.waitForRound(round);
        this.currentRound += 1;
        return nextMessages;
      }
      throw new Error('Did not get result from round transition');
    }

    return null;
  }

  async start(): Promise<R> {
    let nextMessages: Message[] = null;
    while (this.currentRound < this.totalRounds) {
      nextMessages = await this.nextRound(nextMessages);
    }

    const previousRound = this.rounds[this.currentRound - 1];
    this.onTransition(
      previousRound ? previousRound.name : null,
      this.finalizer.name,
    );

    return this.finalizer.finalize(nextMessages);
  }
}

export const onTransition = (previousRound: string, current: string) => {
  let message = '';
  if (previousRound) {
    message = `transition from ${previousRound} to ${current}`;
  } else {
    message = `transition to ${current}`;
  }
  console.info(message);
};
