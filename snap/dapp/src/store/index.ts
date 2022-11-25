import { configureStore } from "@reduxjs/toolkit";
import keysReducer from "./keys";
import proofsReducer from "./proofs";
import receiptsReducer from "./receipts";
import sessionReducer from "./session";
import dialogsReducer from "./dialogs";
import snackbarsReducer from "./snackbars";
import workerProgressReducer from "./worker-progress";

const store = configureStore({
  reducer: {
    keys: keysReducer,
    proofs: proofsReducer,
    receipts: receiptsReducer,
    session: sessionReducer,
    dialogs: dialogsReducer,
    snackbars: snackbarsReducer,
    progress: workerProgressReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [
          "session/setTransport",
          "session/setSignCandidate",
          "session/setSignProof",

          "receipts/saveMessageProof/pending",
          "receipts/saveMessageProof/fulfilled",
          "receipts/saveMessageProof/rejected",

          "receipts/saveTransactionReceipt/pending",
          "receipts/saveTransactionReceipt/fulfilled",
          "receipts/saveTransactionReceipt/rejected",
        ],
        // Ignore these field paths in all actions
        ignoredActionPaths: [],
        // Ignore these paths in the state
        ignoredPaths: ["session", "receipts"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
