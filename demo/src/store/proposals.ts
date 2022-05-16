import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SignResult, Session } from "@metamask/mpc-client";

export interface SignResultWithAddress {
  signResult: SignResult;
  publicAddress: string;
}

export interface Proposal {
  key: string;
  message: string;
  creator: boolean;
  session?: Session;
  result?: SignResultWithAddress;
}

export interface ProposalsState {
  proposals: Proposal[];
}

const initialState: ProposalsState = {
  proposals: [],
};

const proposalsSlice = createSlice({
  name: "proposals",
  initialState,
  reducers: {
    addProposal: (state, { payload }: PayloadAction<Proposal>) => {
      state.proposals = [payload, ...state.proposals];
    },
    updateProposal: (state, { payload }: PayloadAction<Proposal>) => {
      state.proposals = state.proposals.map((prop) => {
        if (payload.key === prop.key) {
          return payload;
        } else {
          return prop;
        }
      });
    },
  },
});

export const { addProposal, updateProposal } = proposalsSlice.actions;
export const proposalsSelector = (state: { proposals: ProposalsState }) =>
  state.proposals;
export default proposalsSlice.reducer;
