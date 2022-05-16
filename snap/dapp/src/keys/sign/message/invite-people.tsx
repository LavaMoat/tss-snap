import React from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";

import { Stack } from "@mui/material";

import { SignMessageProps } from "./index";
import { sessionSelector } from "../../../store/session";
import { SigningType, SignMessage } from "../../../types";
import InviteCard, { inviteHref } from "../../invite-card";
import SignMessageView from "../message-view";
import Approval from "../approval";

export default function InvitePeople(props: SignMessageProps) {
  const { address } = useParams();
  const { next } = props;
  const { group, session, signCandidate } = useSelector(sessionSelector);
  const { message, digest } = signCandidate.value as SignMessage;

  const totalInvites = group.params.parties - 1;
  const hrefPrefix = `keys/${address}/sign/join/message`;
  const href = inviteHref(hrefPrefix, group.uuid, session.uuid);
  const links = Array(totalInvites)
    .fill("")
    .map(() => href);

  return (
    <Stack spacing={4}>
      <SignMessageView message={message} digest={digest} />
      <InviteCard links={links} />
      <Approval signingType={SigningType.MESSAGE} onApprove={next} />
    </Stack>
  );
}
