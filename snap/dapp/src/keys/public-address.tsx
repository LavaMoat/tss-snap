import React, { useState } from "react";

import { Stack, Button, Tooltip, Snackbar, Alert } from "@mui/material";

import CopyIcon from "@mui/icons-material/ContentCopy";

import { copyToClipboard, abbreviateAddress } from "../utils";

type PublicAddressProps = {
  address: string;
  abbreviate?: boolean;
};

export default function PublicAddress(props: PublicAddressProps) {
  const [copied, setCopied] = useState(false);
  const { address, abbreviate } = props;

  const copyAddress = async (
    e: React.MouseEvent<HTMLElement>,
    address: string
  ) => {
    e.stopPropagation();
    await copyToClipboard(address);
    setCopied(true);
  };

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip title="Copy address">
          <Button
            startIcon={<CopyIcon />}
            sx={{ textTransform: "none" }}
            onClick={(e) => copyAddress(e, address)}
          >
            {abbreviate ? abbreviateAddress(address) : address}
          </Button>
        </Tooltip>
      </Stack>

      <Snackbar
        open={copied}
        autoHideDuration={3000}
        onClose={() => setCopied(false)}
      >
        <Alert onClose={() => setCopied(false)} severity="success">
          Address copied to clipboard
        </Alert>
      </Snackbar>
    </>
  );
}
