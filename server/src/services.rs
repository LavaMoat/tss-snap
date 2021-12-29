use serde::{Deserialize, Serialize};

use async_trait::async_trait;
use json_rpc2::{futures::*, Request, Response, Result};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::RwLock;

use common::Parameters;

use super::server::{Group, State};

#[derive(Debug, Clone, Deserialize)]
struct GroupCreateParams {
    label: String,
    params: Parameters,
}

#[derive(Debug, Serialize)]
struct GroupCreateReply {
    uuid: String,
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
        let mut response = None;
        if req.matches("group_create") {
            let params: Vec<GroupCreateParams> = req.deserialize()?;
            let info = params.get(0).unwrap();

            let (conn_id, state) = ctx;

            let group =
                Group::new(*conn_id, info.params.clone(), info.label.clone());
            let group_key = group.uuid.clone();
            let uuid = group.uuid.clone();
            let mut writer = state.write().await;
            writer.groups.insert(group_key, group);

            let res = serde_json::to_value(&GroupCreateReply { uuid }).unwrap();
            response = Some((req, res).into());
        }
        Ok(response)
    }
}
