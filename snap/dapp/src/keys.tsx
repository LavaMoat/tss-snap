import React from "react";

import {
  Stack,
  Button,
  Link,
  Typography,
} from '@mui/material';

export default function Keys() {
  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="div">
        Keys
      </Typography>

      <Typography variant="body1" component="div" gutterBottom>
        No key shares yet.
      </Typography>

      <Button variant="contained" onClick={() => console.log('create key share')}>Create a new key share</Button>
    </Stack>
  );
}
