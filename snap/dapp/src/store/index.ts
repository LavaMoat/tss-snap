import { configureStore } from "@reduxjs/toolkit";
import keysReducer from "./keys";
import sessionReducer from "./session";
import dialogsReducer from "./dialogs";
import snackbarsReducer from "./snackbars";

const store = configureStore({
  reducer: {
    keys: keysReducer,
    session: sessionReducer,
    dialogs: dialogsReducer,
    snackbars: snackbarsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ["session/setTransport"],
        // Ignore these field paths in all actions
        ignoredActionPaths: [],
        // Ignore these paths in the state
        ignoredPaths: ["session"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
