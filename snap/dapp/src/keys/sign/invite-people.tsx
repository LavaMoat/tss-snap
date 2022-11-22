import React from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";

import { Stack } from "@mui/material";

import { StepProps } from "./";
import { sessionSelector } from "../../store/session";
import { SigningType, SignMessage } from "../../types";
import InviteCard, { inviteHref } from "../invite-card";
import SignMessageView from "./message-view";
import Approval from "./approval";

type InvitePeopleProps = {
  kind: SigningType;
} & StepProps;

export default function InvitePeople(props: InvitePeopleProps) {
  const { address } = useParams();
  const { next } = props;
  const { group, session, signCandidate } = useSelector(sessionSelector);
  const { message, digest } = signCandidate.value as SignMessage;

  const kind = props.kind == SigningType.MESSAGE ? "message" : "transaction";

  const totalInvites = group.params.parties - 1;
  const hrefPrefix = `keys/${address}/sign/join/${kind}`;
  const href = inviteHref(hrefPrefix, group.uuid, session.uuid);
  const links = Array(totalInvites)
    .fill("")
    .map(() => href);

  const view =
    props.kind == SigningType.MESSAGE ? (
      <SignMessageView message={message} digest={digest} />
    ) : (
      <p>TX</p>
    );

  return (
    <Stack spacing={4}>
      {view}
      <InviteCard links={links} />
      <Approval signingType={props.kind} onApprove={next} />
    </Stack>
  );
}
