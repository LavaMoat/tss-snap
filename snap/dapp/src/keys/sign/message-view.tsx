import React from 'react';

import {
  Stack,
  Paper,
  Typography,
  Divider,
} from "@mui/material";

import {toHexString} from '../../utils';

type SignMessageViewProps = {
  message: string;
  digest: string;
}

export default function SignMessageView(props: SignMessageViewProps) {
  const { message, digest} = props;
  return (
    <Paper variant="outlined">
      <Stack padding={2} spacing={2}>
        <Stack>
          <Typography variant="subtitle1" component="div">
            Message to sign
          </Typography>
        </Stack>
        <Divider />
        <Typography variant="body1" component="div">
          {message}
        </Typography>
        <Divider />
        <Typography variant="body2" component="div" color="text.secondary">
          {toHexString(digest)}
        </Typography>
      </Stack>
    </Paper>
  );
}
