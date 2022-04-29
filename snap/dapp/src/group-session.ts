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

export type GroupFormData = [string, Parameters];

// Sets up the session and group for an owner.
export async function createGroupSession(
  kind: SessionKind,
  data: GroupFormData,
  websocket: WebSocketClient,
  dispatch: AppDispatch
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
    params: [uuid, kind],
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
// This is used by participants that are invited by the owner.
export async function joinGroupSession(
  kind: SessionKind,
  groupId: string,
  sessionId: string,
  websocket: WebSocketClient,
  dispatch: AppDispatch
): Promise<[GroupInfo, Session]> {

  const group = await websocket.rpc({
    method: "Group.join",
    params: groupId,
  });
  dispatch(setGroup(group));

  let session = await websocket.rpc({
    method: "Session.join",
    params: [groupId, sessionId, kind],
  });

  const partyNumber = await websocket.rpc({
    method: "Session.signup",
    params: [groupId, sessionId, kind],
  });

  session = {
    ...session,
    partySignup: { number: partyNumber, uuid: session.uuid },
  };
  dispatch(setSession(session));

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
