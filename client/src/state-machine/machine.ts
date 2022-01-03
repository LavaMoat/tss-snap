import { EventEmitter } from "events";

export interface State<T, U> {
  name: string;
  data?: T;
  transition: (previousState?: T, transitionData?: U) => Promise<T | null>;
}

export type TransitionHandler<T, U> = (
  index: number,
  previousState?: State<T, U>,
  nextState?: State<T, U>
) => void;

export class StateMachine<T, U> extends EventEmitter {
  states: State<T, U>[];
  index: number;
  stateData: T | null;
  transitionGuard: boolean;

  constructor(states: State<T, U>[]) {
    super();
    this.states = states;
    this.index = 0;
    this.stateData = null;
  }

  async next(transitionData?: U): Promise<T | null> {
    if (this.transitionGuard) {
      throw new Error(
        "state machine cannot proceed whilst a transition is running"
      );
    }

    const nextState = this.states[this.index];
    if (nextState) {
      const previousState = this.states[this.index - 1];
      this.emit("transitionEnter", this.index, previousState, nextState);
      this.transitionGuard = true;
      this.stateData = await nextState.transition(
        this.stateData,
        transitionData
      );
      this.transitionGuard = false;
      this.index++;
      this.emit("transitionExit");
    }

    return this.stateData;
  }
}
