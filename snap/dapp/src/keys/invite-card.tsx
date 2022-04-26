import React from "react";
import { useDispatch } from "react-redux";

import {
  Box,
  Stack,
  Typography,
  Paper,
  Link,
} from "@mui/material";

import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import { setSnackbar } from "../store/snackbars";
import { copyToClipboard } from "../utils";

export function inviteHref(
  hrefPrefix: string,
  groupId: string,
  sessionId: string) {
  return `${location.protocol}//${location.host}/#/${hrefPrefix}/${groupId}/${sessionId}`;
}

type InviteProps = {
  onCopy: () => void;
  links: string[];
};

type InviteLinkProps = {
  onCopy: () => void;
  href: string;
  index: number;
}

function InviteLink(props: InviteLinkProps) {
  const dispatch = useDispatch();
  const {href, onCopy, index} = props;

  const copy = async (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    await copyToClipboard(href);
    dispatch(setSnackbar({
      message: 'Link copied to clipboard',
      severity: 'success'
    }));
    onCopy();
  };

  return (
    <Stack direction="row"
      onClick={copy}
      sx={{
        cursor: 'pointer',
      }}>
      <Box component="span"
        sx={{
          border: '1px solid gray',
          padding: '8px',
          borderTopLeftRadius: '4px',
          borderBottomLeftRadius: '4px',
        }}>
        <Typography
          variant="body2"
          component="span"
          color="text.secondary"
        >
          #{index + 1}
        </Typography>
      </Box>
      <Box
        sx={{
          border: '1px solid gray',
          overflow: 'hidden',
          padding: '0 8px',
          alignItems: 'center',
          display: 'flex',
        }}
        component="span">
        <Link
          href={href}
          onClick={copy}
          sx={{
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}>
          {href}
        </Link>
      </Box>
      <Box
        component="span"
        sx={{
          border: '1px solid gray',
          padding: '8px',
          borderTopRightRadius: '4px',
          borderBottomRightRadius: '4px',
        }}>
        <Stack direction="row" spacing={1}>
          <ContentCopyIcon color="primary" />
        </Stack>
      </Box>
    </Stack>
  );
}

export default function InviteCard(props: InviteProps) {
  const { onCopy, links } = props;

  return (
    <Paper variant="outlined">
      <Stack padding={4} spacing={2}>
        <Stack>
          <Typography
            variant="body1"
            component="span"
          >
            Send these links via email or private message to the people you
            wish to invite.
          </Typography>
          <Typography
            variant="body2"
            component="span"
            color="text.secondary"
          >
            Click a link to copy it to your clipboard
          </Typography>
        </Stack>
        {
          links.map((href, index) => {
            return (
              <InviteLink
                key={index}
                href={href}
                onCopy={onCopy}
                index={index} />
            );
          })
        }
      </Stack>
    </Paper>
  );
}
