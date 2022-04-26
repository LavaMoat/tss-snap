import React, { useState } from 'react';

import {
  Button,
  Stack,
  Paper,

  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  TextField,
} from "@mui/material";

import { SignMessageProps } from './index';

function MessageForm(props: SignMessageProps) {
  const [value, setValue] = useState("");
  const [messageError, setMessageError] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessageError(false);
    if (value === "") {
      setMessageError(true);
    } else {
      props.onMessage(value);
    }
  }

  return (
    <form id="message" onSubmit={onSubmit} noValidate>
      <Stack>
        <TextField
            label="Message"
            multiline
            minRows={6}
            maxRows={6}
            error={messageError}
            value={value}
            onChange={onChange}
          />
      </Stack>
    </form>
  );
}

function ChooseKeyShare(props: SignMessageProps) {
  const { share, onShareChange, selectedParty } = props;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const partyNumber = parseInt(e.target.value);
    onShareChange(partyNumber);
  }

  const { threshold, parties } = share;

  return (
    <Paper variant="outlined">
      <Stack padding={2}>
        <FormControl>
          <FormLabel id="key-share-label">Choose a key share ({`${threshold + 1} of ${parties}`})</FormLabel>
          <RadioGroup
            onChange={onChange}
            aria-labelledby="key-share-label"
            value={selectedParty.toString()}
            name="key-share-group">
            {share.items.map((partyNumber, index) => {
              return <FormControlLabel
                key={index}
                value={partyNumber.toString()}
                control={<Radio />}
                label={`Party #${partyNumber}`} />
            })}
          </RadioGroup>
        </FormControl>
      </Stack>
    </Paper>
  );
}

export default function CreateMessage(props: SignMessageProps) {
  return (
    <Stack spacing={4}>
      <ChooseKeyShare {...props} />
      <MessageForm {...props} />
      <Button variant="contained" type="submit" form="message">Next</Button>
    </Stack>
  )
}
