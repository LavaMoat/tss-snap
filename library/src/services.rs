//! Services for handling JSON-RPC requests.
//!
//! Some methods send notifications to connected clients, see the
//! method's documentation for more details.
//!
//! Notifications sent to connected clients are sent as a tuple
//! of `String` event name followed by an arbitrary JSON `Value`
//! payload for the event.
//!
//! ## Methods
//!
//! These are the JSON-RPC methods clients may call; some methods will broadcast events to connected clients, see the documentation for each method for more information.
//!
//! ### Group.create
//!
//! * `label`: Human-friendly `String` label for the group.
//! * `parameters`: [Parameters](Parameters) for key generation and signing.
//!
//! Create a new group; the client that calls this method automatically joins the group.
//!
//! Returns the UUID for the group.
//!
//! ### Group.join
//!
//! * `group_id`: The `String` UUID for the group.
//!
//! Register the calling client as a member of the group.
//!
//! Returns the group object.
//!
//! ### Session.create
//! * `group_id`: The `String` UUID for the group.
//! * `kind`: The `String` kind of session (either `keygen` or `sign`).
//!
//! Create a new session.
//!
//! Returns the session object.
//!
//! ### Session.join
//!
//! * `group_id`: The `String` UUID for the group.
//! * `session_id`: The `String` UUID for the session.
//! * `kind`: The `String` kind of session (either `keygen` or `sign`).
//!
//! Join an existing session.
//!
//! Returns the session object.
//!
//! ### Session.signup
//!
//! * `group_id`: The `String` UUID for the group.
//! * `session_id`: The `String` UUID for the session.
//! * `kind`: The `String` kind of session (either `keygen` or `sign`).
//!
//! Register as a co-operating party for a session.
//!
//! When the required number of parties have signed up to a session a `sessionSignup` event is emitted to all the clients in the session. For key generation there must be `parties` clients in the session and for signing there must be `threshold + 1` clients registered for the session.
//!
//! Returns the party signup number.
//!
//! ### Session.load
//!
//! * `group_id`: The `String` UUID for the group.
//! * `session_id`: The `String` UUID for the session.
//! * `kind`: The `String` kind of session (must be `keygen`).
//! * `number`: The `u16` party signup number.
//!
//! Load a client into a given slot (party signup number). This is used to allow the party signup numbers allocated to saved key shares to be assigned and validated in the context of a session.
//!
//! The given `number` must be in range and must be an available slot.
//!
//! When the required number of `parties` have been allocated to a session a `sessionLoad` event is emitted to all the clients in the session.
//!
//! Returns the party signup number.
//!
//! ### Session.participant
//!
//! * `group_id`: The `String` UUID for the group.
//! * `session_id`: The `String` UUID for the session.
//! * `index`: The `u16` party index.
//! * `number`: The `u16` party signup number.
//!
//! Provide a mapping between receiver indices for a signing session so that the server can locate the connection identifier when relaying peer to peer messages.
//!
//! When signing clients must provide an array of the indices used during DKG, the party index is the index (plus one) of each client's local key index in that array. This is the value that the server sees as the receiver when relaying peer to peer messages but the server has no knowledge of this index so client's must register a mapping from the party index to the server-issued party number so that the correct connection id can be resolved.
//!
//! Returns an empty response to the caller.
//!
//! ### Session.message
//!
//! * `group_id`: The `String` UUID for the group.
//! * `session_id`: The `String` UUID for the session.
//! * `kind`: The `String` kind of session (either `keygen` or `sign`).
//! * `message`: The message to broadcast or send peer to peer.
//!
//! Relay a message to all the other peers in the session (broadcast) or send directly to another peer.
//!
//! A `message` is treated as peer to peer when the `receiver` field is present which should be the party signup `number` for the peer for a keygen session or the party index for a signing session.
//!
//! This method is a notification and does not return anything to the caller.
//!
//! ### Session.finish
//!
//! * `group_id`: The `String` UUID for the group.
//! * `session_id`: The `String` UUID for the session.
//! * `number`: The `u16` party signup number.
//!
//! Indicate the session has been finished for the calling client.
//!
//! When all the clients in a session have called this method the server will emit a `sessionClosed` event to all the clients in the session.
//!
//! This method is a notification and does not return anything to the caller.
//!
use async_trait::async_trait;
use json_rpc2::{futures::*, Error, Request, Response, Result, RpcError};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

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
    GroupFull(Uuid),
    /// Error generated when a group does not exist.
    #[error("group {0} does not exist")]
    GroupDoesNotExist(Uuid),
    /// Error generated when a session does not exist.
    #[error("group {0} does not exist")]
    SessionDoesNotExist(Uuid),
    /// Error generated when a party number does not exist.
    #[error("party {0} does not exist")]
    PartyDoesNotExist(u16),
    /// Error generated when a party number does not belong to the caller.
    #[error("party {0} is not valid in this context")]
    BadParty(u16),
    /// Error generated when the receiver for a peer to peer message
    /// does not exist.
    #[error("receiver {0} for peer to peer message does not exist")]
    BadPeerReceiver(u16),
    /// Error generated when a client connection does not belong to
    /// the specified group.
    #[error("client {0} does not belong to the group {1}")]
    BadConnection(usize, Uuid),
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
/// Register a participant lookup for a signing session.
pub const SESSION_PARTICIPANT: &str = "Session.participant";
/// Method to broadcast or relay a message peer to peer.
pub const SESSION_MESSAGE: &str = "Session.message";
/// Method to indicate a session is finished.
pub const SESSION_FINISH: &str = "Session.finish";

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

type GroupCreateParams = (String, Parameters);
type SessionCreateParams = (Uuid, SessionKind, Option<Value>);
type SessionJoinParams = (Uuid, Uuid, SessionKind);
type SessionSignupParams = (Uuid, Uuid, SessionKind);
type SessionLoadParams = (Uuid, Uuid, SessionKind, u16);
type SessionParticipantParams = (Uuid, Uuid, u16, u16);
type SessionMessageParams = (Uuid, Uuid, SessionKind, Message);
type SessionFinishParams = (Uuid, Uuid, u16);

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
    session_id: Uuid,
    #[serde(rename = "proposalId")]
    proposal_id: String,
    message: String,
}

/// Service for replying to client requests.
pub struct ServiceHandler;

#[async_trait]
impl Service for ServiceHandler {
    type Data = (usize, Arc<RwLock<State>>, Arc<Mutex<Option<Notification>>>);

    async fn handle(
        &self,
        req: &Request,
        ctx: &Self::Data,
    ) -> Result<Option<Response>> {
        let response = match req.method() {
            GROUP_CREATE => {
                let (conn_id, state, _) = ctx;
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
                let res = serde_json::to_value(group.uuid).unwrap();
                let mut writer = state.write().await;
                writer.groups.insert(group.uuid, group);
                Some((req, res).into())
            }
            GROUP_JOIN => {
                let (conn_id, state, _) = ctx;
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
                        if !group.clients.iter().any(|c| c == conn_id)
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
                let (conn_id, state, notification) = ctx;
                let params: SessionCreateParams = req.deserialize()?;
                let (group_id, kind, value) = params;
                let mut writer = state.write().await;
                let group =
                    get_group_mut(conn_id, &group_id, &mut writer.groups)?;
                let session = Session::from((kind.clone(), value));
                let key = session.uuid;
                group.sessions.insert(key, session.clone());

                if let SessionKind::Keygen = kind {
                    let value =
                        serde_json::to_value((SESSION_CREATE_EVENT, &session))
                            .unwrap();
                    let response: Response = value.into();

                    // Notify everyone else in the group a session was created
                    let ctx = Notification::Group {
                        group_id,
                        filter: Some(vec![*conn_id]),
                        response,
                    };
                    let mut writer = notification.lock().await;
                    *writer = Some(ctx);
                }

                let res = serde_json::to_value(&session).unwrap();
                Some((req, res).into())
            }
            SESSION_JOIN => {
                let (conn_id, state, _) = ctx;
                let params: SessionJoinParams = req.deserialize()?;
                let (group_id, session_id, _kind) = params;

                let mut writer = state.write().await;
                let group =
                    get_group_mut(conn_id, &group_id, &mut writer.groups)?;
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
                let (conn_id, state, notification) = ctx;
                let params: SessionSignupParams = req.deserialize()?;
                let (group_id, session_id, kind) = params;

                let mut writer = state.write().await;
                let group =
                    get_group_mut(conn_id, &group_id, &mut writer.groups)?;
                if let Some(session) = group.sessions.get_mut(&session_id) {
                    let party_number = session.signup(*conn_id);

                    tracing::info!(party_number, "session signup {}", conn_id);

                    // Enough parties are signed up to the session
                    if threshold(
                        &kind,
                        &group.params,
                        session.party_signups.len(),
                    ) {
                        let value = serde_json::to_value((
                            SESSION_SIGNUP_EVENT,
                            &session_id,
                        ))
                        .unwrap();
                        let response: Response = value.into();
                        let ctx = Notification::Session {
                            group_id,
                            session_id,
                            filter: None,
                            response,
                        };

                        let mut writer = notification.lock().await;
                        *writer = Some(ctx);
                    }

                    let res = serde_json::to_value(party_number).unwrap();
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
                let (conn_id, state, notification) = ctx;
                let params: SessionLoadParams = req.deserialize()?;
                let (group_id, session_id, kind, party_number) = params;

                let mut writer = state.write().await;
                let group =
                    get_group_mut(conn_id, &group_id, &mut writer.groups)?;
                if let Some(session) = group.sessions.get_mut(&session_id) {
                    let res = serde_json::to_value(party_number).unwrap();
                    match session.load(&group.params, *conn_id, party_number) {
                        Ok(_) => {
                            // Enough parties are loaded into the session
                            if threshold(
                                &kind,
                                &group.params,
                                session.party_signups.len(),
                            ) {
                                let value = serde_json::to_value((
                                    SESSION_LOAD_EVENT,
                                    &session_id,
                                ))
                                .unwrap();
                                let response: Response = value.into();
                                let ctx = Notification::Session {
                                    group_id,
                                    session_id,
                                    filter: None,
                                    response,
                                };
                                let mut writer = notification.lock().await;
                                *writer = Some(ctx);
                            }

                            Some((req, res).into())
                        }
                        Err(err) => return Err(Error::from(Box::from(err))),
                    }
                } else {
                    return Err(Error::from(Box::from(
                        ServiceError::SessionDoesNotExist(session_id),
                    )));
                }
            }
            // Register a participant lookup for a signing session.
            //
            // This allows clients to map the receiver party index to a
            // server issued party number which in turn allows the server
            // to correctly resolve the connection identifier that we need
            // to relay for peer to peer rounds.
            SESSION_PARTICIPANT => {
                let (conn_id, state, _) = ctx;
                let params: SessionParticipantParams = req.deserialize()?;
                let (group_id, session_id, party_index, party_number) = params;

                let mut writer = state.write().await;
                let group =
                    get_group_mut(conn_id, &group_id, &mut writer.groups)?;
                if let Some(session) = group.sessions.get_mut(&session_id) {
                    session.participants.insert(party_index, party_number);
                    Some(req.into())
                } else {
                    return Err(Error::from(Box::from(
                        ServiceError::SessionDoesNotExist(session_id),
                    )));
                }
            }
            // Mark the session as finished for a party.
            SESSION_FINISH => {
                let (conn_id, state, notification) = ctx;
                let params: SessionFinishParams = req.deserialize()?;
                let (group_id, session_id, party_number) = params;

                let mut writer = state.write().await;
                let group =
                    get_group_mut(conn_id, &group_id, &mut writer.groups)?;
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

                        let mut signups = session
                            .party_signups
                            .iter()
                            .map(|(n, _)| *n)
                            .collect::<Vec<u16>>();
                        let mut completed = session
                            .finished
                            .iter()
                            .cloned()
                            .collect::<Vec<u16>>();

                        signups.sort();
                        completed.sort();

                        if signups == completed {
                            let value = serde_json::to_value((
                                SESSION_CLOSED_EVENT,
                                completed,
                            ))
                            .unwrap();
                            let response: Response = value.into();

                            let ctx = Notification::Session {
                                group_id,
                                session_id,
                                filter: None,
                                response,
                            };

                            let mut writer = notification.lock().await;
                            *writer = Some(ctx);
                        }

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
            SESSION_MESSAGE => {
                let (conn_id, state, notification) = ctx;
                let params: SessionMessageParams = req.deserialize()?;
                let (group_id, session_id, _kind, msg) = params;

                let reader = state.read().await;

                // Check we have valid group / session
                let (_group, session) = get_group_session(
                    conn_id,
                    &group_id,
                    &session_id,
                    &reader.groups,
                )?;

                // Send direct to peer
                if let Some(receiver) = &msg.receiver {
                    if let Some(s) = session.resolve(*receiver) {
                        let value =
                            serde_json::to_value((SESSION_MESSAGE_EVENT, msg))
                                .unwrap();

                        let response: Response = value.into();
                        let message = (s.1, response);

                        let ctx = Notification::Relay {
                            messages: vec![message],
                        };

                        let mut writer = notification.lock().await;
                        *writer = Some(ctx);
                    } else {
                        return Err(Error::from(Box::from(
                            ServiceError::BadPeerReceiver(*receiver),
                        )));
                    }
                // Handle broadcast round
                } else {
                    let value =
                        serde_json::to_value((SESSION_MESSAGE_EVENT, msg))
                            .unwrap();
                    let response: Response = value.clone().into();

                    let ctx = Notification::Session {
                        group_id,
                        session_id,
                        filter: Some(vec![*conn_id]),
                        response,
                    };

                    let mut writer = notification.lock().await;
                    *writer = Some(ctx);
                }

                // Must ACK so we indicate the service method exists
                Some(req.into())
            }
            _ => None,
        };
        Ok(response)
    }
}

fn get_group_mut<'a>(
    conn_id: &usize,
    group_id: &Uuid,
    groups: &'a mut HashMap<Uuid, Group>,
) -> Result<&'a mut Group> {
    if let Some(group) = groups.get_mut(group_id) {
        // Verify connection is part of the group clients
        if group.clients.iter().any(|c| c == conn_id) {
            Ok(group)
        } else {
            Err(Error::from(Box::from(ServiceError::BadConnection(
                *conn_id,
                *group_id,
            ))))
        }
    } else {
        Err(Error::from(Box::from(ServiceError::GroupDoesNotExist(
            *group_id,
        ))))
    }
}

fn get_group<'a>(
    conn_id: &usize,
    group_id: &Uuid,
    groups: &'a HashMap<Uuid, Group>,
) -> Result<&'a Group> {
    if let Some(group) = groups.get(group_id) {
        // Verify connection is part of the group clients
        if group.clients.iter().any(|c| c == conn_id) {
            Ok(group)
        } else {
            Err(Error::from(Box::from(ServiceError::BadConnection(
                *conn_id,
                *group_id,
            ))))
        }
    } else {
        Err(Error::from(Box::from(ServiceError::GroupDoesNotExist(
            *group_id,
        ))))
    }
}

fn get_group_session<'a>(
    conn_id: &usize,
    group_id: &Uuid,
    session_id: &Uuid,
    groups: &'a HashMap<Uuid, Group>,
) -> Result<(&'a Group, &'a Session)> {
    let group = get_group(conn_id, group_id, groups)?;
    if let Some(session) = group.sessions.get(session_id) {
        Ok((group, session))
    } else {
        Err(Error::from(Box::from(ServiceError::SessionDoesNotExist(
            *session_id,
        ))))
    }
}

/// Helper to determine if we met a session party threshold.
fn threshold(
    kind: &SessionKind,
    params: &Parameters,
    num_entries: usize,
) -> bool {
    let parties = params.parties as usize;
    let threshold = params.threshold as usize;
    let required_num_entries = match kind {
        SessionKind::Keygen => parties,
        SessionKind::Sign => threshold + 1,
    };
    num_entries == required_num_entries
}
