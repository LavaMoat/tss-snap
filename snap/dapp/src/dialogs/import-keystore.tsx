import React, { useState } from "react";
import { useDispatch } from 'react-redux';

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

import { ImportKeyStore } from './index';
import FileUploadReader from '../components/file-upload-reader';
import {setSnackbar} from '../store/snackbars';
import { decode } from '../utils';
//import ConfirmPasswordForm from './confirm-password-form';

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

  const onFormSubmit = (password: string) => {
    handleOk(request, password);
  }

  const onFileSelect = (file: File) => {
    //console.log("file selected", file.name);
  };

  const onFileChange = (data: FileBuffer) => {
    console.log("Got file change event: ", data);

    try {
      const contents = decode(new Uint8Array(data.buffer));
      try {
        const keystore = JSON.parse(contents);

        /*
        if (keystore.address !== address) {
          dispatch(
            setSnackbar({
              message: `Keystore address ${keystore.address} does not match expected address: ${address}, perhaps you uploaded the wrong keystore?`,
              severity: "error",
            })
          );
        }
        */
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
  };

  const content = keyStore === null ? (
    <FileUploadReader onChange={onFileChange} onSelect={onFileSelect} />
  ) : (
    <p>TODO</p>
  );

  const actions = keyStore === null ? (
    <Button onClick={handleCancel}>Cancel</Button>
  ) : (
    <>
      <Button onClick={handleCancel}>Cancel</Button>
      <Button
        type="submit"
        form="password-form"
        variant="contained">
        OK
      </Button>
    </>
  );

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle color="text.secondary">Import key share</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Stack>
            <Typography variant="body1" component="div">
              Your key share will be imported from an encrypted key store protected by a password.
            </Typography>
            <Typography variant="body2" component="div" color="text.secondary">
              Upload a key store to begin.
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
