// Helper functions for saving and loading the snap state data.
//
import { AppState } from "../types";
import snapId from "../snap-id";

function getDefaultAppState(): AppState {
  return {
    keyShares: [],
    messageProofs: {},
    transactionReceipts: {},
  };
}

async function getState() {
  return await ethereum.request({
    method: "wallet_invokeSnap",
    params: {
      snapId,
      request: {
        method: "getState",
      },
    },
  });
}

async function setState(value: AppState) {
  return await ethereum.request({
    method: "wallet_invokeSnap",
    params: {
      snapId,
      request: {
        method: "updateState",
        params: value,
      },
    },
  });
}

export async function loadStateData(): Promise<AppState> {
  const state: AppState = (await getState()) as AppState;
  if (state !== null) {
    return state;
  }
  // Treat no state as a default empty state object
  return getDefaultAppState();
}

export async function saveStateData(appState: AppState): Promise<void> {
  await setState(appState);
}

export async function clearStateData(): Promise<void> {
  await setState(getDefaultAppState());
}
