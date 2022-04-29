import React from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';

import {
  Stack,
  Paper,
  Typography,
  Divider,
} from "@mui/material";

import { SignMessageProps } from './index';
import {keysSelector} from '../../../store/keys';
import {toHexString} from '../../../utils';
import InviteCard, { inviteHref } from '../../invite-card';

export default function InvitePeople(props: SignMessageProps) {
  const { address } = useParams();
  const { message, messageHash, selectedParty } = props;
  const { group, session } = useSelector(keysSelector);

  const totalInvites = group.params.parties - 1;
  const hrefPrefix = `keys/${address}/sign/join/message`;
  const href = inviteHref(hrefPrefix, group.uuid, session.uuid)
  const links = Array(totalInvites).fill("").map(() => href);

  return (
    <Stack spacing={4}>
      <Typography variant="h5" component="div">
      </Typography>
      <Paper variant="outlined">
        <Stack padding={2} spacing={2}>
          <Stack>
            <Typography variant="subtitle1" component="div">
              Message to sign
            </Typography>
            <Typography variant="subtitle2" component="div" color="text.secondary">
              Using key share for party #{selectedParty}
            </Typography>
          </Stack>
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
      <InviteCard links={links} />
    </Stack>
  )
}
