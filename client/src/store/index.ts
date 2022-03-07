import { configureStore } from "@reduxjs/toolkit";
import groupReducer from "./group";
import keygenReducer from "./keygen";

const store = configureStore({
  reducer: {
    group: groupReducer,
    keygen: keygenReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
