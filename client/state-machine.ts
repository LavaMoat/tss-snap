export interface State<T, U> {
  data?: T;
  transition: (previousState?: T, userData?: U) => Promise<T | null>;
}

export class StateMachine<T, U> {
  states: State<T, U>[];
  index: number;
  stateData: T | null;

  constructor(states: State<T, U>[]) {
    this.states = states;
    this.index = 0;
    this.stateData = null;
  }

  async next(userData?: U): Promise<T | null> {
    const state = this.states[this.index];
    if (state) {
      this.stateData = await state.transition(this.stateData, userData);
      this.index++;
    }
    return this.stateData;
  }
}
