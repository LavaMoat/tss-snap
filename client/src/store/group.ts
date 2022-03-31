import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Parameters, GroupInfo } from "@metamask/mpc-client";

/*
export interface GroupInfo {
  uuid: string;
  label: string;
  params: Parameters;
}
*/

export interface GroupState {
  group?: GroupInfo;
}

const initialState: GroupState = {
  group: null,
};

const groupSlice = createSlice({
  name: "group",
  initialState,
  reducers: {
    setGroup: (state, { payload }: PayloadAction<GroupInfo>) => {
      state.group = payload;
    },
  },
});

export const { setGroup } = groupSlice.actions;
export const groupSelector = (state: { group: GroupState }) => state.group;
export default groupSlice.reducer;
