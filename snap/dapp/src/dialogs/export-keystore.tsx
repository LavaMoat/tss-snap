import React from "react";

import {
  Alert,
  Stack,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import { ExportKeyStore } from './index';
import ConfirmPasswordForm from './confirm-password-form';

interface ExportKeyStoreProps {
  open: boolean;
  request: ExportKeyStore;
  handleCancel: () => void;
  handleOk: (result: ExportKeyStore, password: string) => void;
}

export default function ExportKeyStoreDialog(
  props: ExportKeyStoreProps
) {
  const { open, request, handleCancel, handleOk } = props;
  //const [address, number, length] = request;

  const onFormSubmit = (password: string) => {
    handleOk(request, password);
  }

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle color="text.secondary">Export key share</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Stack>
            <Typography variant="body1" component="div">
              Your key share will be exported to an encrypted key store protected by a password.
            </Typography>
            <Typography variant="body2" component="div" color="text.secondary">
              Choose a password for the keystore (minimum 12 characters)
            </Typography>
          </Stack>
          <ConfirmPasswordForm onFormSubmit={onFormSubmit} />

          <Alert severity="warning">
            You will not be able to import the key share if you forget the password
          </Alert>

        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button
          type="submit"
          form="confirm-password-form"
          variant="contained">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
