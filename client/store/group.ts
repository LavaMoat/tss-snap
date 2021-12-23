import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface GroupInfo {
  uuid: string;
  label: string;
  parties: number;
  threshold: number;
}

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
