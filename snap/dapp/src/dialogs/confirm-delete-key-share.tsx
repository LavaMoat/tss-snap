import * as React from "react";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

import { DeleteRequest } from './index';

interface ConfirmDeleteSecretProps {
  open: boolean;
  request: DeleteRequest;
  handleCancel: () => void;
  handleOk: (result: DeleteRequest) => void;
}

export default function ConfirmDeleteSecretDialog(
  props: ConfirmDeleteSecretProps
) {
  const { open, request, handleCancel, handleOk } = props;
  const [address, number] = request;

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle color="text.secondary">Delete Key Share</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body1" component="div">
            Are you sure you want to permanently delete this key share?
          </Typography>

          <Paper variant="outlined">
            <Box padding={2}>Key share for party #{number} in {address}</Box>
          </Paper>

          <Alert severity="warning">
            Deletion is permanent, it cannot be undone.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={() => handleOk(request)} variant="contained">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
