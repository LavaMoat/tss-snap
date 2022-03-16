//! Services for handling JSON-RPC requests.
//!
//! Requests handled by the server are first routed via the
//! primary `ServiceHandler` and any response is sent back to the
//! client making the request; these requests may mutate the server state.
//!
//! Afterwards the same request is sent to the `NotifyHandler` which
//! must **never mutate the server state** but may send notifications
//! to connected clients based on the updated server state.
//!
//! Notifications sent to connected clients are sent as a tuple
//! of `String` event name followed by an arbitrary JSON `Value`
//! payload for the event.
//!
use async_trait::async_trait;
use json_rpc2::{futures::*, Error, Request, Response, Result, RpcError};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::{Mutex, RwLock};

use super::server::{
    Group, Notification, Parameters, Session, SessionKind, State,
};

/// Error thrown by the JSON-RPC services.
#[derive(Debug, Error)]
pub enum ServiceError {
    /// Error generated when a parties parameter is too small.
    #[error("parties must be greater than one")]
    PartiesTooSmall,
    /// Error generated when a parties parameter is too small.
    #[error("threshold must be greater than zero")]
    ThresholdTooSmall,
    /// Error generated when the threshold exceeds the parties.
    #[error("threshold must be less than parties")]
    ThresholdRange,
    /// Error generated when a group has enough connections.
    #[error("group {0} is full, cannot accept new connections")]
    GroupFull(String),
    /// Error generated when a group does not exist.
    #[error("group {0} does not exist")]
    GroupDoesNotExist(String),
    /// Error generated when a session does not exist.
    #[error("group {0} does not exist")]
    SessionDoesNotExist(String),
    /// Error generated when a party number does not exist.
    #[error("party {0} does not exist")]
    PartyDoesNotExist(u16),
    /// Error generated when a party number does not belong to the caller.
    #[error("party {0} is not valid in this context")]
    BadParty(u16),
    /// Error generated when a session kind was given, but
    /// does not match the expected kind.
    #[error("keygen session kind expected")]
    KeygenSessionExpected,
    /// Error generated when the receiver for a peer to peer message
    /// does not exist.
    #[error("receiver {0} for peer to peer message does not exist")]
    BadPeerReceiver(u16),
    /// Error generated when a client connection does not belong to
    /// the specified group.
    #[error("client {0} does not belong to the group {1}")]
    BadConnection(usize, String),
}

/// Error data indicating the connection should be closed.
pub const CLOSE_CONNECTION: &str = "close-connection";

/// Method to create a group.
pub const GROUP_CREATE: &str = "Group.create";
/// Method to join a group.
pub const GROUP_JOIN: &str = "Group.join";
/// Method to create a session.
pub const SESSION_CREATE: &str = "Session.create";
/// Method to join a session.
pub const SESSION_JOIN: &str = "Session.join";
/// Method to signup a session.
pub const SESSION_SIGNUP: &str = "Session.signup";
/// Method to load a party number into a session.
pub const SESSION_LOAD: &str = "Session.load";
/// Method to broadcast or relay a message peer to peer.
pub const SESSION_MESSAGE: &str = "Session.message";
/// Method to indicate a session is finished.
pub const SESSION_FINISH: &str = "Session.finish";
/// Method to notify of a proposal for signing.
pub const NOTIFY_PROPOSAL: &str = "Notify.proposal";
/// Method to notify a proposal has been signed.
pub const NOTIFY_SIGNED: &str = "Notify.signed";

/// Notification sent when a session has been created.
///
/// Used primarily during key generation so other connected
/// clients can automatically join the session.
pub const SESSION_CREATE_EVENT: &str = "sessionCreate";
/// Notification sent when all expected parties have signed
/// up to a session.
pub const SESSION_SIGNUP_EVENT: &str = "sessionSignup";
/// Notification sent when all parties have loaded a party signup
/// number into a session.
pub const SESSION_LOAD_EVENT: &str = "sessionLoad";
/// Notification sent to clients with broadcast or peer to peer messages.
pub const SESSION_MESSAGE_EVENT: &str = "sessionMessage";
/// Notification sent when a session has been marked as finished
/// by all participating clients.
pub const SESSION_CLOSED_EVENT: &str = "sessionClosed";
/// Notification sent when a proposal has been received.
pub const NOTIFY_PROPOSAL_EVENT: &str = "notifyProposal";
/// Notification sent when a proposal has been signed.
pub const NOTIFY_SIGNED_EVENT: &str = "notifySigned";

type Uuid = String;
type GroupCreateParams = (String, Parameters);
type SessionCreateParams = (Uuid, SessionKind);
type SessionJoinParams = (Uuid, Uuid, SessionKind);
type SessionSignupParams = (Uuid, Uuid, SessionKind);
type SessionLoadParams = (Uuid, Uuid, SessionKind, u16);
type SessionMessageParams = (Uuid, Uuid, SessionKind, Message);
type SessionFinishParams = (Uuid, Uuid, u16);
type NotifyProposalParams = (Uuid, Uuid, String, String);
type NotifySignedParams = (Uuid, Uuid, Value);

// Mimics the `Msg` struct
// from `round-based` but doesn't care
// about the `body` data.
#[derive(Serialize, Deserialize)]
struct Message {
    round: u16,
    sender: u16,
    receiver: Option<u16>,
    uuid: String,
    body: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct Proposal {
    #[serde(rename = "sessionId")]
    session_id: String,
    #[serde(rename = "proposalId")]
    proposal_id: String,
    message: String,
}

/// Service for replying to client requests.
pub struct ServiceHandler;

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

                // If parties is less than two then may as well
                // use a standard single-party ECDSA private key
                if parameters.parties <= 1 {
                    return Err(Error::from(Box::from(
                        ServiceError::PartiesTooSmall,
                    )));
                // If threshold is zero then it only
                // takes a single party to sign a request which
                // defeats the point of MPC
                } else if parameters.threshold == 0 {
                    return Err(Error::from(Box::from(
                        ServiceError::ThresholdTooSmall,
                    )));
                // Threshold must be in range `(t + 1) <= n`
                } else if parameters.threshold >= parameters.parties {
                    return Err(Error::from(Box::from(
                        ServiceError::ThresholdRange,
                    )));
                }

                let group =
                    Group::new(*conn_id, parameters.clone(), label.clone());
                let res = serde_json::to_value(&group.uuid).unwrap();
                let mut writer = state.write().await;
                writer.groups.insert(group.uuid.clone(), group);
                Some((req, res).into())
            }
            GROUP_JOIN => {
                let (conn_id, state) = ctx;
                let group_id: Uuid = req.deserialize()?;
                let mut writer = state.write().await;
                if let Some(group) = writer.groups.get_mut(&group_id) {
                    if group.clients.len() == group.params.parties as usize {
                        let error = ServiceError::GroupFull(group_id);
                        let err = RpcError::new(
                            error.to_string(),
                            Some(CLOSE_CONNECTION.to_string()),
                        );
                        Some((req, err).into())
                    } else {
                        if let None =
                            group.clients.iter().find(|c| *c == conn_id)
                        {
                            group.clients.push(*conn_id);
                        }
                        let res = serde_json::to_value(group).unwrap();
                        Some((req, res).into())
                    }
                } else {
                    return Err(Error::from(Box::from(
                        ServiceError::GroupDoesNotExist(group_id),
                    )));
                }
            }
            SESSION_CREATE => {
                let (conn_id, state) = ctx;
                let params: SessionCreateParams = req.deserialize()?;
                let (group_id, kind) = params;
                let mut writer = state.write().await;
                let group =
                    get_group_mut(&conn_id, &group_id, &mut writer.groups)?;
                let session = Session::from(kind.clone());
                let key = session.uuid.clone();
                group.sessions.insert(key, session.clone());
                let res = serde_json::to_value(&session).unwrap();
                Some((req, res).into())
            }
            SESSION_JOIN => {
                let (conn_id, state) = ctx;
                let params: SessionJoinParams = req.deserialize()?;
                let (group_id, session_id, _kind) = params;

                let mut writer = state.write().await;
                let group =
                    get_group_mut(&conn_id, &group_id, &mut writer.groups)?;
                if let Some(session) = group.sessions.get_mut(&session_id) {
                    let res = serde_json::to_value(&session).unwrap();
                    Some((req, res).into())
                } else {
                    return Err(Error::from(Box::from(
                        ServiceError::SessionDoesNotExist(session_id),
                    )));
                }
            }
            SESSION_SIGNUP => {
                let (conn_id, state) = ctx;
                let params: SessionSignupParams = req.deserialize()?;
                let (group_id, session_id, _kind) = params;

                let mut writer = state.write().await;
                let group =
                    get_group_mut(&conn_id, &group_id, &mut writer.groups)?;
                if let Some(session) = group.sessions.get_mut(&session_id) {
                    let party_number = session.signup(*conn_id);
                    let res = serde_json::to_value(&party_number).unwrap();
                    Some((req, res).into())
                } else {
                    return Err(Error::from(Box::from(
                        ServiceError::SessionDoesNotExist(session_id),
                    )));
                }
            }
            // Load an existing party signup into the session
            // this is used to support loading existing key shares.
            SESSION_LOAD => {
                let (conn_id, state) = ctx;
                let params: SessionLoadParams = req.deserialize()?;
                let (group_id, session_id, kind, party_number) = params;

                if let SessionKind::Keygen = kind {
                    let mut writer = state.write().await;
                    let group =
                        get_group_mut(&conn_id, &group_id, &mut writer.groups)?;
                    if let Some(session) = group.sessions.get_mut(&session_id) {
                        let res = serde_json::to_value(&party_number).unwrap();
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
                        return Err(Error::from(Box::from(
                            ServiceError::SessionDoesNotExist(session_id),
                        )));
                    }
                } else {
                    return Err(Error::from(Box::from(
                        ServiceError::KeygenSessionExpected,
                    )));
                }
            }
            // Mark the session as finished for a party.
            SESSION_FINISH => {
                let (conn_id, state) = ctx;
                let params: SessionFinishParams = req.deserialize()?;
                let (group_id, session_id, party_number) = params;

                let mut writer = state.write().await;
                let group =
                    get_group_mut(&conn_id, &group_id, &mut writer.groups)?;
                if let Some(session) = group.sessions.get_mut(&session_id) {
                    let existing_signup = session
                        .party_signups
                        .iter()
                        .find(|(s, _)| s == &party_number);

                    if let Some((_, conn)) = existing_signup {
                        // The party number must belong to the caller
                        // which we check by comparing connection identifiers
                        if conn != conn_id {
                            return Err(Error::from(Box::from(
                                ServiceError::BadParty(party_number),
                            )));
                        }

                        session.finished.insert(party_number);
                        Some(req.into())
                    } else {
                        return Err(Error::from(Box::from(
                            ServiceError::PartyDoesNotExist(party_number),
                        )));
                    }
                } else {
                    return Err(Error::from(Box::from(
                        ServiceError::SessionDoesNotExist(session_id),
                    )));
                }
            }
            SESSION_MESSAGE | NOTIFY_PROPOSAL | NOTIFY_SIGNED => {
                // Must ACK so we indicate the service method exists
                // the actual logic is handled by the notification service
                Some(req.into())
            }
            _ => None,
        };
        Ok(response)
    }
}

/// Service for broadcasting notifications to connected clients.
pub struct NotifyHandler;

#[async_trait]
impl Service for NotifyHandler {
    type Data = (usize, Arc<RwLock<State>>, Arc<Mutex<Notification>>);
    async fn handle(
        &self,
        req: &Request,
        ctx: &Self::Data,
    ) -> Result<Option<Response>> {
        let response = match req.method() {
            SESSION_CREATE => {
                let (conn_id, state, notification) = ctx;
                let params: SessionCreateParams = req.deserialize()?;
                let (group_id, kind) = params;

                if let SessionKind::Keygen = kind {
                    let reader = state.read().await;
                    let group = get_group(&conn_id, &group_id, &reader.groups)?;

                    let last_session =
                        group.sessions.values().last().unwrap().clone();
                    let res = serde_json::to_value((
                        SESSION_CREATE_EVENT,
                        &last_session,
                    ))
                    .unwrap();

                    // Notify everyone else in the group a session was created
                    {
                        let ctx = Notification::Group {
                            group_id,
                            filter: Some(vec![*conn_id]),
                        };
                        let mut writer = notification.lock().await;
                        *writer = ctx;
                    }

                    Some(res.into())
                } else {
                    return Err(Error::from(Box::from(
                        ServiceError::KeygenSessionExpected,
                    )));
                }
            }
            SESSION_SIGNUP => {
                let (conn_id, state, notification) = ctx;
                let params: SessionSignupParams = req.deserialize()?;
                let (group_id, session_id, kind) = params;

                let reader = state.read().await;

                let (group, session) = get_group_session(
                    &conn_id,
                    &group_id,
                    &session_id,
                    &reader.groups,
                )?;
                handle_threshold_notify(
                    session.party_signups.len(),
                    group_id,
                    session_id,
                    group,
                    session,
                    kind,
                    notification,
                    SESSION_SIGNUP_EVENT,
                )
                .await
            }
            SESSION_LOAD => {
                let (conn_id, state, notification) = ctx;
                let params: SessionLoadParams = req.deserialize()?;
                let (group_id, session_id, kind, _party_number) = params;

                let reader = state.read().await;

                let (group, session) = get_group_session(
                    &conn_id,
                    &group_id,
                    &session_id,
                    &reader.groups,
                )?;
                handle_threshold_notify(
                    session.party_signups.len(),
                    group_id,
                    session_id,
                    group,
                    session,
                    kind,
                    notification,
                    SESSION_LOAD_EVENT,
                )
                .await
            }
            SESSION_MESSAGE => {
                let (conn_id, state, notification) = ctx;
                let params: SessionMessageParams = req.deserialize()?;
                let (group_id, session_id, _kind, msg) = params;

                let reader = state.read().await;
                // Check we have valid group / session
                let (_group, session) = get_group_session(
                    &conn_id,
                    &group_id,
                    &session_id,
                    &reader.groups,
                )?;

                // Send direct to peer
                if let Some(receiver) = &msg.receiver {
                    if let Some(s) =
                        session.party_signups.iter().find(|s| s.0 == *receiver)
                    {
                        let result =
                            serde_json::to_value((SESSION_MESSAGE_EVENT, msg))
                                .unwrap();

                        let response: Response = result.into();
                        let message = (s.1, response);

                        {
                            let ctx = Notification::Relay {
                                messages: vec![message],
                            };

                            let mut writer = notification.lock().await;
                            *writer = ctx;
                        }

                        // Must return a response so the server processes
                        // our notifications even though our actual responses
                        // are in the messages assigned to the notification context
                        Some((serde_json::Value::Null).into())
                    } else {
                        return Err(Error::from(Box::from(
                            ServiceError::BadPeerReceiver(*receiver),
                        )));
                    }

                // Handle broadcast round
                } else {
                    {
                        let ctx = Notification::Session {
                            group_id,
                            session_id,
                            filter: Some(vec![*conn_id]),
                        };

                        let mut writer = notification.lock().await;
                        *writer = ctx;
                    }

                    let result =
                        serde_json::to_value((SESSION_MESSAGE_EVENT, msg))
                            .unwrap();

                    Some(result.into())
                }
            }
            SESSION_FINISH => {
                let (conn_id, state, notification) = ctx;
                let params: SessionFinishParams = req.deserialize()?;
                let (group_id, session_id, _party_number) = params;

                let reader = state.read().await;

                let (_group, session) = get_group_session(
                    &conn_id,
                    &group_id,
                    &session_id,
                    &reader.groups,
                )?;

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
                    let result =
                        serde_json::to_value((SESSION_CLOSED_EVENT, completed))
                            .unwrap();

                    {
                        let ctx = Notification::Session {
                            group_id,
                            session_id,
                            filter: None,
                        };

                        let mut writer = notification.lock().await;
                        *writer = ctx;
                    }

                    Some(result.into())
                } else {
                    None
                }
            }
            NOTIFY_PROPOSAL => {
                let (conn_id, _state, notification) = ctx;
                let params: NotifyProposalParams = req.deserialize()?;
                let (group_id, session_id, proposal_id, message) = params;

                let proposal = Proposal {
                    session_id,
                    proposal_id,
                    message,
                };

                let res =
                    serde_json::to_value((NOTIFY_PROPOSAL_EVENT, &proposal))
                        .unwrap();

                {
                    let ctx = Notification::Group {
                        group_id,
                        filter: Some(vec![*conn_id]),
                    };

                    let mut writer = notification.lock().await;
                    *writer = ctx;
                }

                Some(res.into())
            }
            NOTIFY_SIGNED => {
                let (conn_id, state, notification) = ctx;
                let params: NotifySignedParams = req.deserialize()?;
                let (group_id, session_id, value) = params;

                let reader = state.read().await;

                let (_group, session) = get_group_session(
                    &conn_id,
                    &group_id,
                    &session_id,
                    &reader.groups,
                )?;

                let participants = session
                    .party_signups
                    .iter()
                    .map(|(_, c)| c.clone())
                    .collect::<Vec<usize>>();

                let result =
                    serde_json::to_value((NOTIFY_SIGNED_EVENT, value)).unwrap();

                {
                    let ctx = Notification::Group {
                        group_id,
                        filter: Some(participants),
                    };

                    let mut writer = notification.lock().await;
                    *writer = ctx;
                }
                Some(result.into())
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
) -> Result<&'a mut Group> {
    if let Some(group) = groups.get_mut(group_id) {
        // Verify connection is part of the group clients
        if let Some(_) = group.clients.iter().find(|c| *c == conn_id) {
            Ok(group)
        } else {
            return Err(Error::from(Box::from(ServiceError::BadConnection(
                *conn_id,
                group_id.to_string(),
            ))));
        }
    } else {
        return Err(Error::from(Box::from(ServiceError::GroupDoesNotExist(
            group_id.to_string(),
        ))));
    }
}

fn get_group<'a>(
    conn_id: &usize,
    group_id: &str,
    groups: &'a HashMap<String, Group>,
) -> Result<&'a Group> {
    if let Some(group) = groups.get(group_id) {
        // Verify connection is part of the group clients
        if let Some(_) = group.clients.iter().find(|c| *c == conn_id) {
            Ok(group)
        } else {
            return Err(Error::from(Box::from(ServiceError::BadConnection(
                *conn_id,
                group_id.to_string(),
            ))));
        }
    } else {
        return Err(Error::from(Box::from(ServiceError::GroupDoesNotExist(
            group_id.to_string(),
        ))));
    }
}

fn get_group_session<'a>(
    conn_id: &usize,
    group_id: &str,
    session_id: &str,
    groups: &'a HashMap<String, Group>,
) -> Result<(&'a Group, &'a Session)> {
    let group = get_group(conn_id, group_id, groups)?;
    if let Some(session) = group.sessions.get(session_id) {
        Ok((group, session))
    } else {
        return Err(Error::from(Box::from(ServiceError::SessionDoesNotExist(
            session_id.to_string(),
        ))));
    }
}

async fn handle_threshold_notify(
    num_entries: usize,
    group_id: String,
    session_id: String,
    group: &Group,
    _session: &Session,
    kind: SessionKind,
    notification: &Mutex<Notification>,
    event: &str,
) -> Option<Response> {
    let parties = group.params.parties as usize;
    let threshold = group.params.threshold as usize;
    let required_num_entries = match kind {
        SessionKind::Keygen => parties,
        SessionKind::Sign => threshold + 1,
    };

    // Enough parties are signed up to the session
    if num_entries == required_num_entries {
        println!("Sending threshold notify event {} for {:#?}", event, kind);

        let res = serde_json::to_value((event, &session_id)).unwrap();

        // Notify everyone in the session that enough
        // parties have signed up to the session
        {
            let ctx = Notification::Session {
                group_id,
                session_id,
                filter: None,
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
