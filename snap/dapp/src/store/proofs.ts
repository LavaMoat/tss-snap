import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

import { loadStateData, saveStateData } from "./state";
import { SignProof } from "../types";
import { toHexString } from "../utils";

// Load all message proofs grouped by key address.
const loadProofsData = async () => {
  const { messageProofs } = await loadStateData();
  return messageProofs || {};
};

// Retrieve message proofs for the given address.
export const getMessageProofs = createAsyncThunk(
  "proofs/getMessageProofs",
  async (address: string) => {
    const messageProofs = await loadProofsData();
    return messageProofs[address] || [];
  }
);

// Type for saving a message proof mapped by key address to the
// message signing proof.
type SaveMessageProof = [string, SignProof];

export const saveMessageProof = createAsyncThunk(
  "proofs/saveMessageProof",
  async (value: SaveMessageProof) => {
    const [address, proof] = value;
    const appState = await loadStateData();
    appState.messageProofs = appState.messageProofs || {};
    appState.messageProofs[address] = appState.messageProofs[address] || [];
    appState.messageProofs[address].push(proof);
    await saveStateData(appState);
    return await loadProofsData();
  }
);

// Request used to delete a message proof using it's
// address and digest.
type DeleteMessageProof = [string, Uint8Array];

export const deleteMessageProof = createAsyncThunk(
  "proofs/deleteMessageProof",
  async (deleteRequest: DeleteMessageProof) => {
    const [address, digest] = deleteRequest;
    const appState = await loadStateData();
    const messageProofs = appState.messageProofs[address];
    if (messageProofs) {
      // Compare as strings as they are Uint8Arrays and we
      // need to check the values are equal
      const hash = toHexString(digest);
      appState.messageProofs[address] = messageProofs.filter(
        (proof: SignProof) => {
          hash !== toHexString(proof.value.digest);
        }
      );
    }

    await saveStateData(appState);
    return await loadProofsData();
  }
);

export type ProofState = null;
const initialState: ProofState = null;

const proofSlice = createSlice({
  name: "proofs",
  initialState,
  reducers: {},
});

export const proofsSelector = (state: { proofs: ProofState }) => state.proofs;
export default proofSlice.reducer;
