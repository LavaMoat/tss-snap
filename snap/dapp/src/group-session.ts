// Helper functions for creating and joining groups and sessions.
import {
  Parameters,
  SessionKind,
  WebSocketClient,
  WebSocketSink,
  WebSocketStream,
  GroupInfo,
  Session,
} from "@metamask/mpc-client";

import { AppDispatch } from './store';
import {setGroup, setSession, setTransport} from './store/keys';

import { SignValue } from './types';

export type GroupFormData = [string, Parameters];

// Sets up the session and group for an owner.
export async function createGroupSession(
  kind: SessionKind,
  data: GroupFormData,
  websocket: WebSocketClient,
  dispatch: AppDispatch,
  // Party number to load into the session
  keySharePartyNumber?: number,
  // Value to sign which can be associated
  // with the remote session
  signValue?: SignValue,
): Promise<[GroupInfo, Session]> {
  const [label, params] = data;
  const uuid = await websocket.rpc({
    method: "Group.create",
    params: data,
  });
  const group = { label, params, uuid };
  dispatch(setGroup(group));

  let session = await websocket.rpc({
    method: "Session.create",
    params: [uuid, kind, signValue],
  });

  const partyNumber = await websocket.rpc({
    method: "Session.signup",
    params: [uuid, session.uuid, kind],
  });

  session = {
    ...session,
    partySignup: { number: partyNumber, uuid: session.uuid },
  };
  dispatch(setSession(session));

  const stream = new WebSocketStream(
    websocket,
    uuid,
    session.uuid,
    kind
  );

  const sink = new WebSocketSink(
    websocket,
    group.params.parties - 1,
    session.uuid
  );

  dispatch(setTransport({ stream, sink }));

  return [group, session];
}

// Join an existing group and session.
//
// Does not modify the state and just retrieves the group and session
// from the remote server.
//
// This is used during signing sessions to retrieve the value associated
// with the session before approving the value to be signed.
export async function joinGroupSession(
  kind: SessionKind,
  groupId: string,
  sessionId: string,
  websocket: WebSocketClient,
): Promise<[GroupInfo, Session]> {

  const group = await websocket.rpc({
    method: "Group.join",
    params: groupId,
  });

  const session = await websocket.rpc({
    method: "Session.join",
    params: [groupId, sessionId, kind],
  });

  return [group, session];
}

// Join an existing group and session and signup to participate in the
// session computation.
export async function joinGroupSessionWithSignup(
  kind: SessionKind,
  groupId: string,
  sessionId: string,
  websocket: WebSocketClient,
  dispatch: AppDispatch
): Promise<[GroupInfo, Session]> {
  const [group, session] = await joinGroupSession(
    kind,
    groupId,
    sessionId,
    websocket,
  );
  dispatch(setGroup(group));

  const partyNumber = await websocket.rpc({
    method: "Session.signup",
    params: [groupId, sessionId, kind],
  });

  const newSession = {
    ...session,
    partySignup: { number: partyNumber, uuid: session.uuid },
  };
  dispatch(setSession(newSession));

  const stream = new WebSocketStream(
    websocket,
    groupId,
    sessionId,
    kind,
  );

  const sink = new WebSocketSink(
    websocket,
    group.params.parties - 1,
    sessionId
  );

  dispatch(setTransport({ stream, sink }));

  return [group, session];
}
