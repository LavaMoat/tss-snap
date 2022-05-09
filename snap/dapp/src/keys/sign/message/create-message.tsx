import React, { useState } from "react";

import { Button, Stack, TextField } from "@mui/material";

import { SignMessageProps } from "./index";
import ChooseKeyShare from "../choose-key-share";

function MessageForm(props: SignMessageProps) {
  const [value, setValue] = useState("");
  const [messageError, setMessageError] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValue(e.target.value);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessageError(false);
    if (value === "") {
      setMessageError(true);
    } else {
      props.onMessage(value);
    }
  };

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

export default function CreateMessage(props: SignMessageProps) {
  return (
    <Stack spacing={4}>
      <ChooseKeyShare {...props} />
      <MessageForm {...props} />
      <Button variant="contained" type="submit" form="message">
        Next
      </Button>
    </Stack>
  );
}
