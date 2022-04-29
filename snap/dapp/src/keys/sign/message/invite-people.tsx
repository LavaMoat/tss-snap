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
import SignMessageView from '../message-view';

export default function InvitePeople(props: SignMessageProps) {
  const { address } = useParams();
  const { message, digest, selectedParty } = props;
  const { group, session } = useSelector(keysSelector);

  const totalInvites = group.params.parties - 1;
  const hrefPrefix = `keys/${address}/sign/join/message`;
  const href = inviteHref(hrefPrefix, group.uuid, session.uuid)
  const links = Array(totalInvites).fill("").map(() => href);

  return (
    <Stack spacing={4}>
      <SignMessageView message={message} digest={digest} />
      <InviteCard links={links} />
    </Stack>
  )
}
