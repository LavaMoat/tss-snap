import React, {useEffect, useContext} from 'react';
import {useParams} from 'react-router-dom';

import {
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";

import SnapConnect from '../snap-connect';
import NotFound from '../not-found';

export default function Join() {
  const {groupId, sessionId} = useParams();

  if (!groupId || !sessionId) {
    return <NotFound />
  }

  const redirect = `/keys/participate/${groupId}/${sessionId}`;

  return (
    <Stack spacing={2}>
      <Typography variant="h3" component="div" gutterBottom>
        Join a key
      </Typography>
      <Stack>
        <Typography variant="body1" component="div">
          You have been invited to join a key.
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          By owning a share in the key you will be able to participate in collaborative signing of messages and transactions.
        </Typography>
      </Stack>
      <SnapConnect redirect={redirect} />
    </Stack>
  );
}
