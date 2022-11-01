// Helper functions for saving and loading the snap state data.
//
import { encode, decode } from "../utils";
import { AppState } from "../types";
import snapId from "../snap-id";

function getDefaultAppState(): AppState {
  return {
    keyShares: [],
    messageProofs: {},
  };
}

// Key material returned from `getBip44Entropy_*`.
type KeyResponse = {
  key: string;
};

async function getState() {
  return await ethereum.request({
    method: "wallet_invokeSnap",
    params: [
      snapId,
      {
        method: "getState",
      },
    ],
  });
}

async function setState(value: AppState) {
  return await ethereum.request({
    method: "wallet_invokeSnap",
    params: [
      snapId,
      {
        method: "updateState",
        params: value,
      },
    ],
  });
}

export async function loadStateData(): Promise<AppState> {
  console.log("Loading state data...");
  const state: AppState = (await getState()) as AppState;
  console.log("Loaded state data...");
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
