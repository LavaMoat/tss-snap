export interface State<T, U> {
  name: string;
  data?: T;
  transition: (previousState?: T, transitionData?: U) => Promise<T | null>;
}

export class StateMachine<T, U> {
  states: State<T, U>[];
  index: number;
  stateData: T | null;
  inTransition: boolean;

  constructor(states: State<T, U>[]) {
    this.states = states;
    this.index = 0;
    this.stateData = null;
  }

  async next(transitionData?: U): Promise<T | null> {
    if (this.inTransition) {
      throw new Error(
        "state machine cannot proceed whilst a transition is running"
      );
    }

    const state = this.states[this.index];
    if (state) {
      const previousState = this.states[this.index - 1];
      if (previousState) {
        console.log("transition from", previousState.name, "to", state.name);
      } else {
        console.log("transition to", state.name, "with", transitionData);
      }
      this.index++;
      this.inTransition = true;
      this.stateData = await state.transition(this.stateData, transitionData);
      this.inTransition = false;
    }
    return this.stateData;
  }
}
