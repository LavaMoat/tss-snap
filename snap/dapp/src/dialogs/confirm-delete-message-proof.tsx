import React from "react";

import {
  Alert,
  Stack,
  Paper,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import { formatDistanceToNow } from "date-fns";

import { DeleteMessageProof } from "./index";
import { SignMessage } from "../types";

interface ConfirmDeleteMessageProofProps {
  open: boolean;
  request: DeleteMessageProof;
  handleCancel: () => void;
  handleOk: (result: DeleteMessageProof) => void;
}

export default function ConfirmDeleteMessageProofDialog(
  props: ConfirmDeleteMessageProofProps
) {
  const { open, request, handleCancel, handleOk } = props;
  const [address, proof] = request;

  if (!proof) {
    return null;
  }

  const dt = new Date();
  dt.setTime(proof.timestamp);

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle color="text.secondary">Delete Message Proof</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body1" component="div">
            Are you sure you want to permanently delete this message proof?
          </Typography>

          <Paper variant="outlined">
            <Stack padding={2}>
              <Typography variant="body1" component="div">
                {(proof.value as SignMessage).message}
              </Typography>
              <Typography
                variant="body2"
                component="div"
                color="text.secondary"
              >
                Signed by key {address} {formatDistanceToNow(dt)} ago
              </Typography>
            </Stack>
          </Paper>

          <Alert severity="warning">
            Deletion is permanent, it cannot be undone
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
