import React, { useState } from "react";

import { Button, Stack, TextField } from "@mui/material";

type PasswordFormProps = {
  onFormSubmit: (password: string) => void;
  submitLabel: string;
  autoFocus?: boolean;
};

export default function PasswordForm(props: PasswordFormProps) {
  const { onFormSubmit, submitLabel, autoFocus } = props;
  const [password, setPassword] = useState("");

  const onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPassword(e.target.value);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onFormSubmit(password);
  };

  return (
    <form id="password-form" onSubmit={onSubmit} noValidate>
      <Stack spacing={2}>
        <TextField
          type="password"
          label="Passphrase"
          autoFocus={autoFocus}
          value={password}
          onChange={onPasswordChange}
        />
        <Button type="submit" form="password-form">
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}
