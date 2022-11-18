import React from "react";

import { Box, Chip } from "@mui/material";

export default function SelectedChain({chainName}) {
  return (
      <Box>
        <Chip label={chainName ?? ""} color="secondary" />
      </Box>
  );
}

