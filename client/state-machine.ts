export interface State<T, U> {
  name: string;
  data?: T;
  transition: (previousState?: T, transitionData?: U) => Promise<T | null>;
}

type transitionHandler<T, U> = (
  previousState?: State<T, U>,
  nextState?: State<T, U>
) => void;

export class StateMachine<T, U> {
  states: State<T, U>[];
  index: number;
  stateData: T | null;
  inTransition: boolean;
  onTransition: transitionHandler<T, U>;

  constructor(states: State<T, U>[], onTransition: transitionHandler<T, U>) {
    this.states = states;
    this.index = 0;
    this.stateData = null;
    this.onTransition = onTransition;
  }

  async next(transitionData?: U): Promise<T | null> {
    if (this.inTransition) {
      throw new Error(
        "state machine cannot proceed whilst a transition is running"
      );
    }

    const nextState = this.states[this.index];
    if (nextState) {
      const previousState = this.states[this.index - 1];
      this.onTransition(previousState, nextState);
      this.inTransition = true;
      this.stateData = await nextState.transition(
        this.stateData,
        transitionData
      );
      this.inTransition = false;
      this.index++;
    }
    return this.stateData;
  }
}
