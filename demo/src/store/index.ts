import { configureStore } from "@reduxjs/toolkit";
import groupReducer from "./group";
import keygenReducer from "./keygen";
import proposalsReducer from "./proposals";

const store = configureStore({
  reducer: {
    group: groupReducer,
    keygen: keygenReducer,
    proposals: proposalsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
