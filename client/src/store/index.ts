import { configureStore, Action } from "@reduxjs/toolkit";
import groupReducer from "./group";

const store = configureStore({
  reducer: {
    group: groupReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
