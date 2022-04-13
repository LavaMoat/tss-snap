import React from "react";
import { useSelector } from "react-redux";

import { Stack, Typography } from "@mui/material";
import { keysSelector } from "../store/keys";

export default function Save() {
  const { group } = useSelector(keysSelector);

  return (
    <Stack padding={2} spacing={2} marginTop={2}>
      <Stack>
        <Typography variant="h4" component="div">
          {group.label}
        </Typography>
      </Stack>
      <Stack>
        <Typography variant="body1" component="div">
          Your key share has been saved!
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          Now you can use it to sign messages and transactions.
        </Typography>
      </Stack>
    </Stack>
  );
}
