use async_trait::async_trait;
use json_rpc2::{futures::*, Error, Request, Response, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use common::{Parameters, PeerEntry};

use super::server::{Group, NotificationContext, Phase, Session, State};

use log::warn;

// RPC method calls
pub const GROUP_CREATE: &str = "Group.create";
pub const GROUP_JOIN: &str = "Group.join";
pub const SESSION_CREATE: &str = "Session.create";
pub const SESSION_JOIN: &str = "Session.join";
pub const SESSION_SIGNUP: &str = "Session.signup";
pub const SESSION_LOAD: &str = "Session.load";
pub const SESSION_MESSAGE: &str = "Session.message";
pub const SESSION_FINISH: &str = "Session.finish";

#[deprecated(note = "Use session message instead for gg2020")]
pub const PEER_RELAY: &str = "Peer.relay";

pub const NOTIFY_PROPOSAL: &str = "Notify.proposal";

// Notification event names
pub const SESSION_CREATE_EVENT: &str = "sessionCreate";
pub const SESSION_SIGNUP_EVENT: &str = "sessionSignup";
pub const SESSION_LOAD_EVENT: &str = "sessionLoad";
pub const SESSION_MESSAGE_EVENT: &str = "sessionMessage";
pub const SESSION_CLOSED_EVENT: &str = "sessionClosed";

#[deprecated(note = "Use session message instead for gg2020")]
pub const PEER_RELAY_EVENT: &str = "peerRelay";

pub const NOTIFY_PROPOSAL_EVENT: &str = "notifyProposal";

type Uuid = String;
type GroupCreateParams = (String, Parameters);
type SessionCreateParams = (Uuid, Phase);
type SessionJoinParams = (Uuid, Uuid, Phase);
type SessionSignupParams = (Uuid, Uuid, Phase);
type SessionLoadParams = (Uuid, Uuid, Phase, u16);
type SessionMessageParams = (Uuid, Uuid, Phase, Message);
type SessionFinishParams = (Uuid, Uuid, u16);

#[deprecated(note = "Use session message instead for gg2020")]
type PeerRelayParams = (Uuid, Uuid, Vec<PeerEntry>);
type NotifyProposalParams = (Uuid, Uuid, String);

// Mimics the `Msg` struct
// from `round-based` but doesn't care
// about the `body` data.
#[derive(Serialize, Deserialize)]
struct Message {
    sender: u16,
    receiver: Option<u16>,
    body: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct Proposal {
    #[serde(rename = "sessionId")]
    session_id: String,
    message: String,
}

pub(crate) struct ServiceHandler;

#[async_trait]
impl Service for ServiceHandler {
    type Data = (usize, Arc<RwLock<State>>);
    async fn handle(
        &self,
        req: &Request,
        ctx: &Self::Data,
    ) -> Result<Option<Response>> {
        let response = match req.method() {
            GROUP_CREATE => {
                let (conn_id, state) = ctx;
                let params: GroupCreateParams = req.deserialize()?;
                let (label, parameters) = params;
                let group =
                    Group::new(*conn_id, parameters.clone(), label.clone());
                let res = serde_json::to_value(&group.uuid).unwrap();
                let mut writer = state.write().await;
                writer.groups.insert(group.uuid.clone(), group);
                Some((req, res).into())
            }
            GROUP_JOIN => {
                let (conn_id, state) = ctx;
                let uuid: Uuid = req.deserialize()?;
                let mut writer = state.write().await;
                if let Some(group) = writer.groups.get_mut(&uuid) {
                    if let None = group.clients.iter().find(|c| *c == conn_id) {
                        group.clients.push(*conn_id);
                    }
                    let res = serde_json::to_value(group).unwrap();
                    Some((req, res).into())
                } else {
                    warn!("group does not exist: {}", uuid);
                    // TODO: send error response
                    None
                }
            }
            SESSION_CREATE => {
                let (conn_id, state) = ctx;
                let params: SessionCreateParams = req.deserialize()?;
                let (group_id, phase) = params;
                let mut writer = state.write().await;
                if let Some(group) =
                    get_group_mut(&conn_id, &group_id, &mut writer.groups)
                {
                    let session = Session::from(phase.clone());
                    let key = session.uuid.clone();
                    group.sessions.insert(key, session.clone());
                    let res = serde_json::to_value(&session).unwrap();
                    Some((req, res).into())
                } else {
                    None
                }
            }
            SESSION_JOIN => {
                let (conn_id, state) = ctx;
                let params: SessionJoinParams = req.deserialize()?;
                let (group_id, session_id, _phase) = params;

                let mut writer = state.write().await;
                if let Some(group) =
                    get_group_mut(&conn_id, &group_id, &mut writer.groups)
                {
                    if let Some(session) = group.sessions.get_mut(&session_id) {
                        let res = serde_json::to_value(&session).unwrap();
                        Some((req, res).into())
                    } else {
                        warn!("session does not exist: {}", session_id);
                        // TODO: send error response
                        None
                    }
                } else {
                    None
                }
            }
            SESSION_SIGNUP => {
                let (conn_id, state) = ctx;
                let params: SessionSignupParams = req.deserialize()?;
                let (group_id, session_id, _phase) = params;

                let mut writer = state.write().await;
                if let Some(group) =
                    get_group_mut(&conn_id, &group_id, &mut writer.groups)
                {
                    if let Some(session) = group.sessions.get_mut(&session_id) {
                        let party_number = session.signup(*conn_id);
                        let res = serde_json::to_value(&party_number).unwrap();
                        Some((req, res).into())
                    } else {
                        warn!("session does not exist: {}", session_id);
                        // TODO: send error response
                        None
                    }
                } else {
                    None
                }
            }
            SESSION_LOAD => {
                let (conn_id, state) = ctx;
                let params: SessionLoadParams = req.deserialize()?;
                let (group_id, session_id, phase, party_number) = params;

                if let Phase::Keygen = phase {
                    let mut writer = state.write().await;
                    if let Some(group) =
                        get_group_mut(&conn_id, &group_id, &mut writer.groups)
                    {
                        if let Some(session) =
                            group.sessions.get_mut(&session_id)
                        {
                            let res =
                                serde_json::to_value(&party_number).unwrap();
                            match session.load(
                                &group.params,
                                *conn_id,
                                party_number,
                            ) {
                                Ok(_) => Some((req, res).into()),
                                Err(err) => {
                                    return Err(Error::from(Box::from(err)))
                                }
                            }
                        } else {
                            warn!("session does not exist: {}", session_id);
                            // TODO: send error response
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            SESSION_FINISH => {
                let (conn_id, state) = ctx;
                let params: SessionFinishParams = req.deserialize()?;
                let (group_id, session_id, party_number) = params;

                let mut writer = state.write().await;
                if let Some(group) =
                    get_group_mut(&conn_id, &group_id, &mut writer.groups)
                {
                    if let Some(session) = group.sessions.get_mut(&session_id) {
                        session.finished.insert(party_number);
                        Some(req.into())
                    } else {
                        warn!("session does not exist: {}", session_id);
                        // TODO: send error response
                        None
                    }
                } else {
                    None
                }
            }
            SESSION_MESSAGE | PEER_RELAY | NOTIFY_PROPOSAL => {
                // Must ACK so we indicate the service method exists
                // the actual logic is handled by the notification service
                Some(req.into())
            }
            _ => None,
        };
        Ok(response)
    }
}

pub(crate) struct NotifyHandler;

#[async_trait]
impl Service for NotifyHandler {
    type Data = (usize, Arc<RwLock<State>>, Arc<Mutex<NotificationContext>>);
    async fn handle(
        &self,
        req: &Request,
        ctx: &Self::Data,
    ) -> Result<Option<Response>> {
        let response = match req.method() {
            SESSION_CREATE => {
                let (conn_id, state, notification) = ctx;
                let params: SessionCreateParams = req.deserialize()?;
                let (group_id, phase) = params;

                if let Phase::Keygen = phase {
                    let reader = state.read().await;
                    if let Some(group) =
                        get_group(&conn_id, &group_id, &reader.groups)
                    {
                        let last_session =
                            group.sessions.values().last().unwrap().clone();
                        let res = serde_json::to_value((
                            SESSION_CREATE_EVENT,
                            &last_session,
                        ))
                        .unwrap();

                        // Notify everyone else in the group a session was created
                        {
                            let ctx = NotificationContext {
                                noop: false,
                                group_id: Some(group_id),
                                session_id: None,
                                filter: Some(vec![*conn_id]),
                                messages: None,
                            };
                            let mut writer = notification.lock().await;
                            *writer = ctx;
                        }

                        Some(res.into())
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            SESSION_SIGNUP => {
                let (conn_id, state, notification) = ctx;
                let params: SessionSignupParams = req.deserialize()?;
                let (group_id, session_id, phase) = params;

                let reader = state.read().await;

                if let Some((group, session)) = get_group_session(
                    &conn_id,
                    &group_id,
                    &session_id,
                    &reader.groups,
                ) {
                    handle_threshold_notify(
                        session.party_signups.len(),
                        group_id,
                        session_id,
                        group,
                        session,
                        phase,
                        notification,
                        SESSION_SIGNUP_EVENT,
                    )
                    .await
                } else {
                    None
                }
            }
            SESSION_LOAD => {
                let (conn_id, state, notification) = ctx;
                let params: SessionLoadParams = req.deserialize()?;
                let (group_id, session_id, phase, _party_number) = params;

                let reader = state.read().await;

                if let Some((group, session)) = get_group_session(
                    &conn_id,
                    &group_id,
                    &session_id,
                    &reader.groups,
                ) {
                    handle_threshold_notify(
                        session.party_signups.len(),
                        group_id,
                        session_id,
                        group,
                        session,
                        phase,
                        notification,
                        SESSION_LOAD_EVENT,
                    )
                    .await
                } else {
                    None
                }
            }
            SESSION_MESSAGE => {
                let (conn_id, state, notification) = ctx;
                let params: SessionMessageParams = req.deserialize()?;
                let (group_id, session_id, _phase, msg) = params;

                let reader = state.read().await;
                // Check we have valid group / session
                if let Some((_group, session)) = get_group_session(
                    &conn_id,
                    &group_id,
                    &session_id,
                    &reader.groups,
                ) {
                    // Send direct to peer
                    if let Some(receiver) = &msg.receiver {
                        if let Some(s) = session
                            .party_signups
                            .iter()
                            .find(|s| s.0 == *receiver)
                        {
                            let result = serde_json::to_value((
                                SESSION_MESSAGE_EVENT,
                                msg,
                            ))
                            .unwrap();

                            let response: Response = result.into();
                            let message = (s.1, response);

                            {
                                let ctx = NotificationContext {
                                    noop: false,
                                    group_id: Some(group_id),
                                    session_id: Some(session_id),
                                    filter: None,
                                    messages: Some(vec![message]),
                                };

                                let mut writer = notification.lock().await;
                                *writer = ctx;
                            }

                            // Must return a response so the server processes
                            // our notifications even though our actual responses
                            // are in the messages assigned to the notification context
                            Some((serde_json::Value::Null).into())
                        } else {
                            warn!("could not find receiver {} in session party signups", receiver);
                            None
                        }

                    // Handle broadcast round
                    } else {
                        {
                            let ctx = NotificationContext {
                                noop: false,
                                group_id: Some(group_id),
                                session_id: Some(session_id),
                                filter: Some(vec![*conn_id]),
                                messages: None,
                            };

                            let mut writer = notification.lock().await;
                            *writer = ctx;
                        }

                        let result =
                            serde_json::to_value((SESSION_MESSAGE_EVENT, msg))
                                .unwrap();

                        Some(result.into())
                    }
                } else {
                    None
                }
            }
            SESSION_FINISH => {
                let (conn_id, state, notification) = ctx;
                let params: SessionFinishParams = req.deserialize()?;
                let (group_id, session_id, _party_number) = params;

                let reader = state.read().await;

                if let Some((_group, session)) = get_group_session(
                    &conn_id,
                    &group_id,
                    &session_id,
                    &reader.groups,
                ) {
                    let mut signups = session
                        .party_signups
                        .iter()
                        .map(|(n, _)| n.clone())
                        .collect::<Vec<u16>>();
                    let mut completed =
                        session.finished.iter().cloned().collect::<Vec<u16>>();

                    signups.sort();
                    completed.sort();

                    if signups == completed {
                        let result = serde_json::to_value((
                            SESSION_CLOSED_EVENT,
                            completed,
                        ))
                        .unwrap();

                        {
                            let ctx = NotificationContext {
                                noop: false,
                                group_id: Some(group_id),
                                session_id: Some(session_id),
                                filter: None,
                                messages: None,
                            };
                            let mut writer = notification.lock().await;
                            *writer = ctx;
                        }

                        Some(result.into())
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            PEER_RELAY => {
                let (conn_id, state, notification) = ctx;
                let params: PeerRelayParams = req.deserialize()?;
                let (group_id, session_id, peer_entries) = params;

                let reader = state.read().await;

                if let Some((_group, session)) = get_group_session(
                    &conn_id,
                    &group_id,
                    &session_id,
                    &reader.groups,
                ) {
                    let messages: Vec<(usize, Response)> = peer_entries
                        .into_iter()
                        .filter_map(|entry| {
                            if let Some(s) = session
                                .party_signups
                                .iter()
                                .find(|s| s.0 == entry.party_to)
                            {
                                let result = serde_json::to_value((
                                    PEER_RELAY_EVENT,
                                    entry,
                                ))
                                .unwrap();

                                let response: Response = result.into();
                                Some((s.1, response))
                            } else {
                                None
                            }
                        })
                        .collect();

                    //println!("Setting peer relay messages {}", messages.len());

                    {
                        let ctx = NotificationContext {
                            noop: false,
                            group_id: Some(group_id),
                            session_id: Some(session_id),
                            filter: None,
                            messages: Some(messages),
                        };

                        let mut writer = notification.lock().await;
                        *writer = ctx;
                    }

                    // Must return a response so the server processes
                    // our notifications even though our actual responses
                    // are in the messages assigned to the notification context
                    Some((serde_json::Value::Null).into())
                } else {
                    None
                }
            }
            NOTIFY_PROPOSAL => {
                let (conn_id, _state, notification) = ctx;
                let params: NotifyProposalParams = req.deserialize()?;
                let (group_id, session_id, message) = params;

                let proposal = Proposal {
                    session_id,
                    message,
                };

                let res =
                    serde_json::to_value((NOTIFY_PROPOSAL_EVENT, &proposal))
                        .unwrap();

                {
                    let ctx = NotificationContext {
                        noop: false,
                        group_id: Some(group_id),
                        session_id: None,
                        filter: Some(vec![*conn_id]),
                        messages: None,
                    };
                    let mut writer = notification.lock().await;
                    *writer = ctx;
                }

                Some(res.into())
            }
            _ => None,
        };

        Ok(response)
    }
}

fn get_group_mut<'a>(
    conn_id: &usize,
    group_id: &str,
    groups: &'a mut HashMap<String, Group>,
) -> Option<&'a mut Group> {
    if let Some(group) = groups.get_mut(group_id) {
        // Verify connection is part of the group clients
        if let Some(_) = group.clients.iter().find(|c| *c == conn_id) {
            Some(group)
        } else {
            warn!("connection does not belong to the group");
            None
        }
    } else {
        warn!("group does not exist: {}", group_id);
        // TODO: send error response
        None
    }
}

fn get_group<'a>(
    conn_id: &usize,
    group_id: &str,
    groups: &'a HashMap<String, Group>,
) -> Option<&'a Group> {
    if let Some(group) = groups.get(group_id) {
        // Verify connection is part of the group clients
        if let Some(_) = group.clients.iter().find(|c| *c == conn_id) {
            Some(group)
        } else {
            warn!("connection does not belong to the group");
            None
        }
    } else {
        warn!("group does not exist: {}", group_id);
        // TODO: send error response
        None
    }
}

fn get_group_session<'a>(
    conn_id: &usize,
    group_id: &str,
    session_id: &str,
    groups: &'a HashMap<String, Group>,
) -> Option<(&'a Group, &'a Session)> {
    if let Some(group) = get_group(conn_id, group_id, groups) {
        if let Some(session) = group.sessions.get(session_id) {
            Some((group, session))
        } else {
            warn!("session does not exist: {}", session_id);
            // TODO: send error response
            None
        }
    } else {
        None
    }
}

async fn handle_threshold_notify(
    num_entries: usize,
    group_id: String,
    session_id: String,
    group: &Group,
    _session: &Session,
    phase: Phase,
    notification: &Mutex<NotificationContext>,
    event: &str,
) -> Option<Response> {
    let parties = group.params.parties as usize;
    let threshold = group.params.threshold as usize;
    let required_num_entries = match phase {
        Phase::Keygen => parties,
        Phase::Sign => threshold + 1,
    };

    // Enough parties are signed up to the session
    if num_entries == required_num_entries {
        let res = serde_json::to_value((event, &session_id)).unwrap();

        // Notify everyone in the session that enough
        // parties have signed up to the session
        {
            let ctx = NotificationContext {
                noop: false,
                group_id: Some(group_id),
                session_id: Some(session_id),
                filter: None,
                messages: None,
            };
            let mut writer = notification.lock().await;
            *writer = ctx;
        }

        Some(res.into())
    } else {
        {
            let mut writer = notification.lock().await;
            *writer = Default::default();
        }
        None
    }
}
