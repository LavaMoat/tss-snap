import React, { useState } from "react";
import { useDispatch } from 'react-redux';

import {
  Stack,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import { ImportKeyStore } from './index';
import FileUploadReader from '../components/file-upload-reader';
import PasswordForm from './password-form';
import {setSnackbar} from '../store/snackbars';
import { decode } from '../utils';

interface ImportKeyStoreProps {
  open: boolean;
  handleCancel: () => void;
  handleOk: (result: ImportKeyStore, password: string) => void;
}

export default function ImportKeyStoreDialog(
  props: ImportKeyStoreProps
) {
  const dispatch = useDispatch();
  const { open, handleCancel, handleOk } = props;
  const [keyStore, setKeyStore] = useState(null);
  const [file, setFile] = useState(null);

  const onFormSubmit = (password: string) => {
    handleOk({ keyStore }, password);
    setKeyStore(null);
    setFile(null);
  }

  const onCancel = () => {
    handleCancel();
    setKeyStore(null);
    setFile(null);
  }

  const onFileSelect = (file?: File) => setFile(file);

  const readFileBuffer = async () => {
    if (file) {
      const buffer = await file.arrayBuffer();
      try {
        const contents = decode(new Uint8Array(buffer));
        try {
          const keystore = JSON.parse(contents);
          setKeyStore(keystore);
        } catch (e) {
          console.error(e);
          dispatch(
            setSnackbar({
              message: `Could not parse file as JSON: ${e.message || ""}`,
              severity: "error",
            })
          );
        }
      } catch (e) {
        console.error(e);
        dispatch(
          setSnackbar({
            message: `Could not decode file as UTF-8: ${e.message || ""}`,
            severity: "error",
          })
        );
      }
    }
  };

  const content = keyStore === null ? (
    <FileUploadReader onSelect={onFileSelect} />
  ) : (
    <PasswordForm onFormSubmit={onFormSubmit} autoFocus />
  );

  const actions = keyStore === null ? (
    <>
      <Button onClick={onCancel}>Cancel</Button>
      <Button
        disabled={file === null}
        onClick={readFileBuffer}
        variant="contained">
        Upload
      </Button>
    </>
  ) : (
    <>
      <Button onClick={onCancel}>Cancel</Button>
      <Button
        type="submit"
        form="password-form"
        variant="contained">
        Import
      </Button>
    </>
  );

  const message = keyStore === null ? "Upload a key store" : "Enter the key store password";

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle color="text.secondary">Import key share</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Stack>
            <Typography variant="body1" component="div">
              Your key share will be imported from an encrypted key store.
            </Typography>
            <Typography variant="body2" component="div" color="text.secondary">
              {message}
            </Typography>
          </Stack>
          {content}
        </Stack>
      </DialogContent>
      <DialogActions>
        {actions}
      </DialogActions>
    </Dialog>
  );
}
