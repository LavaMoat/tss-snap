import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type WorkerProgressInfo = {
  message: string;
  totalRounds: number;
  currentRound: number;
};

export type WorkerProgressState = {
  progress: WorkerProgressInfo;
};

const initialState: WorkerProgressState = {
  progress: {
    message: "",
    totalRounds: 0,
    currentRound: 0,
  },
};

const workerProgressSlice = createSlice({
  name: "progress",
  initialState,
  reducers: {
    setWorkerProgress: (
      state,
      { payload }: PayloadAction<WorkerProgressInfo>
    ) => {
      state.progress = payload;
    },
    clearWorkerProgress: (state: WorkerProgressState) => {
      state.progress = initialState.progress;
    },
  },
});

export const { setWorkerProgress, clearWorkerProgress } =
  workerProgressSlice.actions;
export const workerProgressSelector = (state: {
  progress: WorkerProgressState;
}) => state.progress;
export default workerProgressSlice.reducer;
