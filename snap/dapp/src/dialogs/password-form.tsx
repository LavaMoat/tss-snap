import React, { useState } from "react";

import { Button, Stack, TextField } from "@mui/material";

type PasswordFormProps = {
  onFormSubmit: (password: string) => void;
  autoFocus?: boolean;
};

export default function PasswordForm(props: PasswordFormProps) {
  const { onFormSubmit, autoFocus } = props;
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
          label="Password"
          autoFocus={autoFocus}
          value={password}
          onChange={onPasswordChange}
        />
      </Stack>
    </form>
  );
}
