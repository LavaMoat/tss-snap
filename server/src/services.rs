use serde::Deserialize;

use async_trait::async_trait;
use json_rpc2::{futures::*, Request, Response, Result};
use std::sync::Arc;
use tokio::sync::RwLock;

use common::Parameters;

use super::server::{Group, NotificationContext, Phase, Session, State};

use log::warn;

pub const GROUP_CREATE: &str = "group_create";
pub const GROUP_JOIN: &str = "group_join";
pub const SESSION_CREATE: &str = "session_create";
pub const SESSION_JOIN: &str = "session_join";
pub const SESSION_SIGNUP: &str = "session_signup";

type Uuid = String;

#[derive(Debug, Deserialize)]
struct GroupCreateParams {
    label: String,
    params: Parameters,
}

type SessionCreateParams = (Uuid, Phase);
type SessionJoinParams = (Uuid, Uuid, Phase);
type SessionSignupParams = (Uuid, Uuid, Phase);

pub(crate) struct ServiceHandler;

#[async_trait]
impl Service for ServiceHandler {
    type Data = (usize, Arc<RwLock<State>>);
    async fn handle(
        &self,
        req: &mut Request,
        ctx: &Self::Data,
    ) -> Result<Option<Response>> {
        let response = match req.method() {
            GROUP_CREATE => {
                let (conn_id, state) = ctx;
                let params: Vec<GroupCreateParams> = req.deserialize()?;
                let info = params.get(0).unwrap();

                let group = Group::new(
                    *conn_id,
                    info.params.clone(),
                    info.label.clone(),
                );
                let res = serde_json::to_value(&group.uuid).unwrap();
                let group_key = group.uuid.clone();
                let mut writer = state.write().await;
                writer.groups.insert(group_key, group);

                Some((req, res).into())
            }
            GROUP_JOIN => {
                let (conn_id, state) = ctx;

                let params: Vec<String> = req.deserialize()?;
                let uuid = params.get(0).unwrap();

                let mut writer = state.write().await;
                if let Some(group) = writer.groups.get_mut(uuid) {
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
                if let Some(group) = writer.groups.get_mut(&group_id) {
                    // Verify connection is part of the group clients
                    if let Some(_) =
                        group.clients.iter().find(|c| *c == conn_id)
                    {
                        let session = Session::from(phase.clone());
                        let key = session.uuid.clone();
                        group.sessions.insert(key, session.clone());
                        let res = serde_json::to_value(&session).unwrap();
                        Some((req, res).into())
                    } else {
                        warn!("connection for session create does not belong to the group");
                        None
                    }
                } else {
                    warn!("group does not exist: {}", group_id);
                    // TODO: send error response
                    None
                }
            }
            SESSION_JOIN => {
                let (conn_id, state) = ctx;
                let params: SessionJoinParams = req.deserialize()?;
                let (group_id, session_id, _phase) = params;

                let mut writer = state.write().await;
                if let Some(group) = writer.groups.get_mut(&group_id) {
                    // Verify connection is part of the group clients
                    if let Some(_) =
                        group.clients.iter().find(|c| *c == conn_id)
                    {
                        if let Some(session) =
                            group.sessions.get_mut(&session_id)
                        {
                            let res = serde_json::to_value(&session).unwrap();
                            Some((req, res).into())
                        } else {
                            warn!("session does not exist: {}", session_id);
                            // TODO: send error response
                            None
                        }
                    } else {
                        warn!("connection for session join does not belong to the group");
                        None
                    }
                } else {
                    warn!("group does not exist: {}", group_id);
                    // TODO: send error response
                    None
                }
            }
            SESSION_SIGNUP => {
                let (conn_id, state) = ctx;
                let params: SessionSignupParams = req.deserialize()?;
                let (group_id, session_id, _phase) = params;

                let mut writer = state.write().await;
                if let Some(group) = writer.groups.get_mut(&group_id) {
                    // Verify connection is part of the group clients
                    if let Some(_) =
                        group.clients.iter().find(|c| *c == conn_id)
                    {
                        if let Some(session) =
                            group.sessions.get_mut(&session_id)
                        {
                            let party_number = session.signup(*conn_id);
                            let res =
                                serde_json::to_value(&party_number).unwrap();
                            Some((req, res).into())
                        } else {
                            warn!("session does not exist: {}", session_id);
                            // TODO: send error response
                            None
                        }
                    } else {
                        warn!("connection for session signup does not belong to the group");
                        None
                    }
                } else {
                    warn!("group does not exist: {}", group_id);
                    // TODO: send error response
                    None
                }
            }
            _ => None,
        };
        Ok(response)
    }
}

pub(crate) struct NotifyHandler;

#[async_trait]
impl Service for NotifyHandler {
    type Data = (usize, Arc<RwLock<State>>);
    async fn handle(
        &self,
        req: &mut Request,
        ctx: &Self::Data,
    ) -> Result<Option<Response>> {
        let response = match req.method() {
            SESSION_CREATE => {
                let (conn_id, state) = ctx;
                let params: SessionCreateParams = req.deserialize()?;
                let (group_id, _phase) = params;

                let mut writer = state.write().await;
                if let Some(group) = writer.groups.get_mut(&group_id) {
                    // Verify connection is part of the group clients
                    if let Some(_) =
                        group.clients.iter().find(|c| *c == conn_id)
                    {
                        let last_session =
                            group.sessions.values().last().unwrap().clone();
                        let res = serde_json::to_value((
                            SESSION_CREATE,
                            &last_session,
                        ))
                        .unwrap();

                        // Notify everyone else in the group a session was created
                        let ctx = NotificationContext {
                            group_id,
                            session_id: None,
                            filter: Some(vec![*conn_id]),
                        };
                        writer.notification = Some(ctx);

                        Some(res.into())
                    } else {
                        warn!("connection for session create does not belong to the group");
                        None
                    }
                } else {
                    warn!("group does not exist: {}", group_id);
                    // TODO: send error response
                    None
                }
            }
            SESSION_SIGNUP => {
                let (conn_id, state) = ctx;
                let params: SessionSignupParams = req.deserialize()?;
                let (group_id, session_id, phase) = params;

                let mut writer = state.write().await;
                if let Some(group) = writer.groups.get_mut(&group_id) {
                    // Verify connection is part of the group clients
                    if let Some(_) =
                        group.clients.iter().find(|c| *c == conn_id)
                    {
                        if let Some(session) =
                            group.sessions.get_mut(&session_id)
                        {
                            let parties = group.params.parties as usize;
                            let threshold = group.params.threshold as usize;
                            let num_entries = session.party_signups.len();
                            let required_num_entries = match phase {
                                Phase::Keygen => parties,
                                Phase::Sign => threshold + 1,
                            };

                            // Enough parties are signed up to the session
                            if num_entries == required_num_entries {
                                let res = serde_json::to_value((
                                    SESSION_SIGNUP,
                                    &session_id,
                                ))
                                .unwrap();

                                // Notify everyone in the session that enough
                                // parties have signed up to the session
                                let ctx = NotificationContext {
                                    group_id,
                                    session_id: Some(session_id),
                                    filter: None,
                                };
                                writer.notification = Some(ctx);

                                Some(res.into())
                            } else {
                                None
                            }
                        } else {
                            warn!("session does not exist: {}", session_id);
                            // TODO: send error response
                            None
                        }
                    } else {
                        warn!("connection for session signup does not belong to the group");
                        None
                    }
                } else {
                    warn!("group does not exist: {}", group_id);
                    // TODO: send error response
                    None
                }
            }
            _ => None,
        };

        Ok(response)
    }
}
