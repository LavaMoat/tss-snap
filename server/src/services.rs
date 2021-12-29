use serde::{Deserialize, Serialize};

use async_trait::async_trait;
use json_rpc2::{futures::*, Request, Response, Result};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::RwLock;

use common::Parameters;

use super::server::{Group, State};

use log::warn;

const GROUP_CREATE: &str = "group_create";
const GROUP_JOIN: &str = "group_join";

#[derive(Debug, Deserialize)]
struct GroupCreateParams {
    label: String,
    params: Parameters,
}

#[derive(Debug, Serialize)]
struct GroupCreateReply {
    uuid: String,
}

#[derive(Debug, Serialize)]
struct GroupJoinReply {
    group: Group,
}

pub(crate) struct ServiceHandler;

#[async_trait]
impl Service for ServiceHandler {
    type Data = (usize, Arc<RwLock<State>>);
    async fn handle(
        &self,
        req: &mut Request,
        ctx: &Self::Data,
    ) -> Result<Option<Response>> {
        let response = if req.matches(GROUP_CREATE) {
            let (conn_id, state) = ctx;
            let params: Vec<GroupCreateParams> = req.deserialize()?;
            let info = params.get(0).unwrap();

            let group =
                Group::new(*conn_id, info.params.clone(), info.label.clone());
            let group_key = group.uuid.clone();
            let uuid = group.uuid.clone();
            let mut writer = state.write().await;
            writer.groups.insert(group_key, group);

            let res = serde_json::to_value(&GroupCreateReply { uuid }).unwrap();
            Some((req, res).into())
        } else if (req.matches(GROUP_JOIN)) {
            let (conn_id, state) = ctx;

            let params: Vec<String> = req.deserialize()?;
            let uuid = params.get(0).unwrap();

            let mut writer = state.write().await;
            if let Some(group) = writer.groups.get_mut(uuid) {
                if let None = group.clients.iter().find(|c| *c == conn_id) {
                    group.clients.push(*conn_id);
                }

                let res = serde_json::to_value(&GroupJoinReply {
                    group: group.clone(),
                })
                .unwrap();
                Some((req, res).into())
            } else {
                warn!("group does not exist: {}", uuid);
                // TODO: send error response
                None
            }
        } else {
            None
        };
        Ok(response)
    }
}
