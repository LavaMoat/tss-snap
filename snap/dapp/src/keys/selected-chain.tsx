import React from "react";

import { Box, Chip } from "@mui/material";

type SelectedChainProps = {
  chainName: string;
};

export default function SelectedChain(props: SelectedChainProps) {
  return (
    <Box>
      <Chip label={props.chainName ?? ""} color="secondary" />
    </Box>
  );
}
