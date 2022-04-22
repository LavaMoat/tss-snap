import React, { useState } from "react";

import { Stack, TextField } from "@mui/material";

type PasswordFormProps = {
  onFormSubmit: (password: string) => void;
};

export default function PasswordForm(props: PasswordFormProps) {
  const { onFormSubmit } = props;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [passwordError, setPasswordError] = useState(false);
  const [confirmError, setConfirmError] = useState(false);

  const [passwordHelper, setPasswordHelper] = useState("");
  const [confirmHelper, setConfirmHelper] = useState("");

  const onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPassword(e.target.value);

  const onConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfirm(e.target.value);

  const minChars = 12;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setPasswordError(false);
    setConfirmError(false);

    setPasswordHelper("");
    setConfirmHelper("");

    const pass1 = password.trim();
    const pass2 = confirm.trim();

    if (pass1 === "") {
      setPasswordError(true);
      setPasswordHelper("Password is required");
    } else if (pass2 === "") {
      setConfirmError(true);
      setConfirmHelper("Password confirmation is required");
    } else if (password.length < minChars) {
      setPasswordError(true);
      setPasswordHelper("Password must be at least 12 characters");
    } else if (confirm.length < minChars) {
      setConfirmError(true);
      setConfirmHelper("Password must be at least 12 characters");
    } else if (password !== confirm) {
      setPasswordError(true);
      setConfirmError(true);
      setPasswordHelper("Password does not match confirmation");
    } else {
      onFormSubmit(password);
    }
  };

  return (
    <form id="confirm-password-form" onSubmit={onSubmit} noValidate>
      <Stack spacing={2}>
        <TextField
          type="password"
          label="Password"
          error={passwordError}
          helperText={passwordHelper}
          autoFocus
          value={password}
          onChange={onPasswordChange}
        />
        <TextField
          type="password"
          label="Confirm password"
          error={confirmError}
          helperText={confirmHelper}
          value={confirm}
          onChange={onConfirmChange}
        />
      </Stack>
    </form>
  );
}
