import React from "react";

import {
  Stack,
  Paper,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
} from "@mui/material";

import { KeyShareGroup } from "../../store/keys";

export type ChooseKeyShareProps = {
  keyShare: KeyShareGroup;
  onShareChange: (partyNumber: number) => void;
  selectedParty: number;
};

export default function ChooseKeyShare(props: ChooseKeyShareProps) {
  const { keyShare, onShareChange, selectedParty } = props;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const partyNumber = parseInt(e.target.value);
    onShareChange(partyNumber);
  };

  const { threshold, parties } = keyShare;

  return (
    <Paper variant="outlined">
      <Stack padding={2}>
        <FormControl>
          <FormLabel id="key-share-label">
            Choose a key share ({`${threshold + 1} of ${parties}`})
          </FormLabel>
          <RadioGroup
            onChange={onChange}
            aria-labelledby="key-share-label"
            value={selectedParty.toString()}
            name="key-share-group"
          >
            {keyShare.items.map((partyNumber: number, index: number) => {
              return (
                <FormControlLabel
                  key={index}
                  value={partyNumber.toString()}
                  control={<Radio />}
                  label={`Party #${partyNumber}`}
                />
              );
            })}
          </RadioGroup>
        </FormControl>
      </Stack>
    </Paper>
  );
}
