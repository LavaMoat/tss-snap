import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

import { loadStateData, saveStateData } from "./state";
import { TransactionReceipts, SignTxReceipt } from "../types";

// Load all message receipts grouped by key address.
const loadReceiptsData = async (): Promise<TransactionReceipts> => {
  const { transactionReceipts } = await loadStateData();
  return transactionReceipts || {};
};

// Type for saving a message receipt mapped by key address to the
// message signing receipt.
type SaveTransactionReceipt = [string, SignTxReceipt];

export const loadTransactionReceipts = createAsyncThunk(
  "receipts/loadTransactionReceipts",
  loadReceiptsData
);

export const saveTransactionReceipt = createAsyncThunk(
  "receipts/saveTransactionReceipt",
  async (value: SaveTransactionReceipt): Promise<TransactionReceipts> => {
    const [address, receipt] = value;
    const appState = await loadStateData();
    appState.transactionReceipts = appState.transactionReceipts || {};
    appState.transactionReceipts[address] = appState.transactionReceipts[address] || [];
    appState.transactionReceipts[address].push(receipt);
    await saveStateData(appState);
    return loadReceiptsData();
  }
);

// Request used to delete a transaction receipt using it's
// address and digest.
type DeleteTransactionReceipt = [string, string];

export const deleteTransactionReceipt = createAsyncThunk(
  "receipts/deleteTransactionReceipt",
  async (deleteRequest: DeleteTransactionReceipt): Promise<TransactionReceipts> => {
    const [address, hash] = deleteRequest;
    const appState = await loadStateData();
    appState.transactionReceipts = appState.transactionReceipts || {};

    const transactionReceipts = appState.transactionReceipts[address];
    if (transactionReceipts) {
      appState.transactionReceipts[address] = transactionReceipts.filter(
        (receipt: SignTxReceipt) => {
          return hash !== receipt.value.transactionHash;
        }
      );
    }
    await saveStateData(appState);
    return loadReceiptsData();
  }
);

export type ReceiptState = {
  transactions: TransactionReceipts;
};

const initialState: ReceiptState = {
  transactions: {},
};

function updateTransactions(
  state: ReceiptState,
  action: PayloadAction<TransactionReceipts>
) {
  state.transactions = action.payload;
}

const receiptSlice = createSlice({
  name: "receipts",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(loadTransactionReceipts.fulfilled, updateTransactions);
    builder.addCase(saveTransactionReceipt.fulfilled, updateTransactions);
    builder.addCase(deleteTransactionReceipt.fulfilled, updateTransactions);
  },
});

export const receiptsSelector = (state: { receipts: ReceiptState }) => state.receipts;
export default receiptSlice.reducer;
