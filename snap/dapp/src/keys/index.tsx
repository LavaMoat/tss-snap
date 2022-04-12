import React from "react";

import { Stack, Button, Typography } from "@mui/material";

import Create from './create';
import Join from './join';

function Keys() {
  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="div" gutterBottom>
        Keys
      </Typography>

      <Typography variant="body1" component="div" gutterBottom>
        No key shares yet.
      </Typography>

      <Button
        variant="contained"
        onClick={() => console.log("create key share")}
      >
        Create a new key share
      </Button>
    </Stack>
  );
}

export { Keys, Create, Join };
