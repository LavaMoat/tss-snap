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

import { DeleteTxReceipt } from "./index";
import { SignMessage } from "../types";

interface ConfirmDeleteTxReceiptProps {
  open: boolean;
  request: DeleteTxReceipt;
  handleCancel: () => void;
  handleOk: (result: DeleteTxReceipt) => void;
}

export default function ConfirmDeleteTxReceiptDialog(
  props: ConfirmDeleteTxReceiptProps
) {
  const { open, request, handleCancel, handleOk } = props;
  const [address, receipt] = request;

  if (!receipt) {
    return null;
  }

  const dt = new Date();
  dt.setTime(receipt.timestamp);


  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle color="text.secondary">Delete Transaction Receipt</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body1" component="div">
            Are you sure you want to permanently delete this transaction receipt?
          </Typography>

          <Paper variant="outlined">
            <Stack padding={2}>
              <Typography variant="body1" component="div">
                {receipt.amount} ETH to {receipt.value.to}
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
