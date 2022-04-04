import { configureStore } from "@reduxjs/toolkit";
import keysReducer from "./keys";

const store = configureStore({
  reducer: {
    keys: keysReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
