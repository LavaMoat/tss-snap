import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

import { loadStateData, saveStateData } from "./state";
import { MessageProofs, SignProof } from "../types";
import { toHexString } from "../utils";

// Load all message proofs grouped by key address.
const loadProofsData = async (): Promise<MessageProofs> => {
  const { messageProofs } = await loadStateData();
  return messageProofs || {};
};

// Type for saving a message proof mapped by key address to the
// message signing proof.
type SaveMessageProof = [string, SignProof];

export const loadMessageProofs = createAsyncThunk(
  "proofs/loadMessageProofs",
  loadProofsData
);

export const saveMessageProof = createAsyncThunk(
  "proofs/saveMessageProof",
  async (value: SaveMessageProof): Promise<MessageProofs> => {
    const [address, proof] = value;
    const appState = await loadStateData();
    appState.messageProofs = appState.messageProofs || {};
    appState.messageProofs[address] = appState.messageProofs[address] || [];
    appState.messageProofs[address].push(proof);
    await saveStateData(appState);
    return loadProofsData();
  }
);

// Request used to delete a message proof using it's
// address and digest.
type DeleteMessageProof = [string, Uint8Array];

export const deleteMessageProof = createAsyncThunk(
  "proofs/deleteMessageProof",
  async (deleteRequest: DeleteMessageProof): Promise<MessageProofs> => {
    const [address, digest] = deleteRequest;
    const appState = await loadStateData();
    appState.messageProofs = appState.messageProofs || {};

    const messageProofs = appState.messageProofs[address];
    if (messageProofs) {

      // Compare as strings as they are Uint8Arrays and we
      // need to check the values are equal
      const hash = toHexString(digest);
      appState.messageProofs[address] = messageProofs.filter(
        (proof: SignProof) => {
          return hash !== toHexString(proof.value.digest);
        }
      );
    }

    await saveStateData(appState);
    return loadProofsData();
  }
);

export type ProofState = {
  messages: MessageProofs;
};

const initialState: ProofState = {
  messages: {},
};

function updateMessages(
  state: ProofState,
  action: PayloadAction<MessageProofs>
) {
  state.messages = action.payload;
}

const proofSlice = createSlice({
  name: "proofs",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(loadMessageProofs.fulfilled, updateMessages);
    builder.addCase(saveMessageProof.fulfilled, updateMessages);
    builder.addCase(deleteMessageProof.fulfilled, updateMessages);
  },
});

export const proofsSelector = (state: { proofs: ProofState }) => state.proofs;
export default proofSlice.reducer;
