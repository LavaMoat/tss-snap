import React from "react";
import { useDispatch } from "react-redux";

import { Stack, Button, Tooltip } from "@mui/material";

import CopyIcon from "@mui/icons-material/ContentCopy";

import { setSnackbar } from "../store/snackbars";
import { copyToClipboard, abbreviateAddress } from "../utils";

type PublicAddressProps = {
  address: string;
  abbreviate?: boolean;
};

export default function PublicAddress(props: PublicAddressProps) {
  const dispatch = useDispatch();
  const { address, abbreviate } = props;

  const copyAddress = async (
    e: React.MouseEvent<HTMLElement>,
    address: string
  ) => {
    e.stopPropagation();
    await copyToClipboard(address);

    dispatch(
      setSnackbar({
        message: "Address copied to clipboard",
        severity: "success",
      })
    );
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
    </>
  );
}
