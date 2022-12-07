// Helper functions for creating and joining groups and sessions.
import {
  Parameters,
  SessionKind,
  WebSocketClient,
  WebSocketSink,
  WebSocketStream,
  GroupInfo,
  Session,
} from "@lavamoat/mpc-client";

import { AppDispatch } from "./store";
import { setGroup, setSession, setTransport } from "./store/session";

import { SignValue } from "./types";

export type GroupFormData = [string, Parameters];

async function prepareTransport(
  kind: SessionKind,
  group: GroupInfo,
  session: Session,
  websocket: WebSocketClient,
  dispatch: AppDispatch
): Promise<void> {
  const stream = new WebSocketStream(websocket, group.uuid, session.uuid, kind);
  const expected =
    kind === SessionKind.KEYGEN
      ? group.params.parties - 1
      : group.params.threshold;

  const sink = new WebSocketSink(websocket, expected, session.uuid);
  dispatch(setTransport({ stream, sink }));
}

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
  signValue?: SignValue
): Promise<[GroupInfo, Session]> {
  const [label, params] = data;
  const uuid = await websocket.rpc({
    method: "Group.create",
    params: data,
  });
  const group = { label, params, uuid };
  dispatch(setGroup(group));

  // NOTE: must be an array for JSON serialization otherwise
  // NOTE: Uint8Array is converted to an object which is problematic
  // NOTE: when recipients receive the value
  const value = signValue != null
    ? { ...signValue, digest: Array.from(signValue.digest) }
    : null;

  let session = await websocket.rpc({
    method: "Session.create",
    params: [uuid, kind, value],
  });

  let partyNumber = null;
  if (!keySharePartyNumber) {
    partyNumber = await websocket.rpc({
      method: "Session.signup",
      params: [uuid, session.uuid, kind],
    });
  } else if (keySharePartyNumber > 0) {
    await websocket.rpc({
      method: "Session.load",
      params: [uuid, session.uuid, kind, keySharePartyNumber],
    });
    partyNumber = keySharePartyNumber;
  }

  if (!partyNumber) {
    throw new Error("Unable to determine party number for session");
  }

  session = {
    ...session,
    partySignup: { number: partyNumber, uuid: session.uuid },
  };
  dispatch(setSession(session));

  await prepareTransport(kind, group, session, websocket, dispatch);

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
  websocket: WebSocketClient
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
    websocket
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

  await prepareTransport(kind, group, session, websocket, dispatch);

  return [group, session];
}

// Try to load a party number into an existing session.
//
// If the call succeeds then the session state is updated to
// reflect the given party number.
export async function loadPartyNumber(
  kind: SessionKind,
  group: GroupInfo,
  session: Session,
  websocket: WebSocketClient,
  dispatch: AppDispatch,
  keySharePartyNumber: number
): Promise<[GroupInfo, Session]> {
  await websocket.rpc({
    method: "Session.load",
    params: [group.uuid, session.uuid, kind, keySharePartyNumber],
  });

  const newSession = {
    ...session,
    partySignup: { number: keySharePartyNumber, uuid: session.uuid },
  };
  dispatch(setSession(newSession));

  await prepareTransport(kind, group, session, websocket, dispatch);

  return [group, newSession];
}
