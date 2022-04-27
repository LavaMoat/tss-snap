import React from 'react';

import {
  Stack,
  Paper,
  Typography,
  Divider,
} from "@mui/material";

import { SignMessageProps } from './index';
import {toHexString} from '../../../utils';
import InviteCard from '../../invite-card';

export default function InvitePeople(props: SignMessageProps) {
  const { message, messageHash } = props;

  const links = [
    "foo"
  ];

  return (
    <Stack spacing={4}>
      <Paper variant="outlined">
        <Stack padding={2} spacing={2}>
          <Typography variant="subtitle1" component="div">
            Message
          </Typography>
          <Divider />
          <Typography variant="body1" component="div">
            {message}
          </Typography>
          <Divider />
          <Typography variant="body2" component="div" color="text.secondary">
            {toHexString(messageHash)}
          </Typography>

        </Stack>
      </Paper>

      <InviteCard
        onCopy={() => {}}
        links={links} />
    </Stack>
  )
}
