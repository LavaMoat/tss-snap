use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

use anyhow::{bail, Result};
use futures_util::{SinkExt, StreamExt, TryFutureExt};
use log::{error, info, trace, warn};
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio_stream::wrappers::UnboundedReceiverStream;
use uuid::Uuid;
use warp::http::header::{HeaderMap, HeaderValue};
use warp::ws::{Message, WebSocket};
use warp::Filter;

use crate::services::*;
use json_rpc2::{Request, Response};

use common::Parameters;

/// Global unique connection id counter.
static CONNECTION_ID: AtomicUsize = AtomicUsize::new(1);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Phase {
    #[serde(rename = "keygen")]
    Keygen,
    #[serde(rename = "sign")]
    Sign,
}

impl Default for Phase {
    fn default() -> Self {
        Phase::Keygen
    }
}

#[derive(Debug, Default, Clone, Serialize)]
pub struct Group {
    pub uuid: String,
    pub params: Parameters,
    pub label: String,
    #[serde(skip)]
    pub clients: Vec<usize>,
    #[serde(skip)]
    pub sessions: HashMap<String, Session>,
}

impl Group {
    pub fn new(conn: usize, params: Parameters, label: String) -> Self {
        Self {
            uuid: Uuid::new_v4().to_string(),
            clients: vec![conn],
            sessions: Default::default(),
            params,
            label,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Session {
    pub uuid: String,
    pub phase: Phase,

    /// Map party number to connection identifier
    #[serde(skip)]
    pub party_signups: Vec<(u16, usize)>,
}

impl Default for Session {
    fn default() -> Self {
        Self {
            uuid: Uuid::new_v4().to_string(),
            phase: Default::default(),
            party_signups: Default::default(),
        }
    }
}

impl From<Phase> for Session {
    fn from(phase: Phase) -> Session {
        Self {
            uuid: Uuid::new_v4().to_string(),
            phase,
            party_signups: Default::default(),
        }
    }
}

impl Session {
    pub fn signup(&mut self, conn: usize) -> u16 {
        let last = self.party_signups.last();
        let num = if last.is_none() {
            1
        } else {
            let (num, _) = last.unwrap();
            num + 1
        };
        self.party_signups.push((num, conn));
        num
    }

    pub fn load(
        &mut self,
        parameters: &Parameters,
        conn: usize,
        party_number: u16,
    ) -> Result<()> {
        if party_number == 0 {
            bail!("party number may not be zero");
        }
        if party_number > parameters.parties {
            bail!("party number is out of range");
        }
        if let Some(_) = self
            .party_signups
            .iter()
            .find(|(num, _)| num == &party_number)
        {
            bail!("party number already exists for this session");
        }
        self.party_signups.push((party_number, conn));
        Ok(())
    }
}

#[derive(Debug)]
pub struct State {
    /// Connected clients.
    pub clients: HashMap<usize, mpsc::UnboundedSender<Message>>,
    /// Groups keyed by unique identifier (UUID)
    pub groups: HashMap<String, Group>,
}

#[derive(Debug)]
pub struct NotificationContext {
    pub noop: bool,
    pub group_id: Option<String>,
    pub session_id: Option<String>,
    pub filter: Option<Vec<usize>>,
    pub messages: Option<Vec<(usize, Response)>>,
}

impl Default for NotificationContext {
    fn default() -> Self {
        Self {
            noop: true,
            group_id: None,
            session_id: None,
            filter: None,
            messages: None,
        }
    }
}

pub struct Server;

impl Server {
    pub async fn start(
        path: &'static str,
        addr: impl Into<SocketAddr>,
        static_files: Option<PathBuf>,
    ) -> Result<()> {
        let state = Arc::new(RwLock::new(State {
            clients: HashMap::new(),
            groups: Default::default(),
        }));
        let state = warp::any().map(move || state.clone());

        let static_files = if let Some(static_files) = static_files {
            if static_files.is_absolute() {
                static_files
            } else {
                let cwd = std::env::current_dir()?;
                cwd.join(static_files)
            }
        } else {
            let mut static_files = std::env::current_dir()?;
            static_files.pop();
            static_files.push("client");
            static_files.push("dist");
            static_files
        };

        if !static_files.is_dir() {
            bail!("static files {} is not a directory", static_files.display());
        }

        let static_files = static_files.canonicalize()?;
        info!("Assets: {}", static_files.display());

        let client = warp::any().and(warp::fs::dir(static_files));

        let mut headers = HeaderMap::new();
        headers.insert(
            "Cross-Origin-Embedder-Policy",
            HeaderValue::from_static("require-corp"),
        );
        headers.insert(
            "Cross-Origin-Opener-Policy",
            HeaderValue::from_static("same-origin"),
        );

        let websocket = warp::path(path).and(warp::ws()).and(state).map(
            |ws: warp::ws::Ws, state| {
                ws.on_upgrade(move |socket| client_connected(socket, state))
            },
        );

        let routes = websocket
            .or(client)
            .with(warp::reply::with::headers(headers));

        warp::serve(routes).run(addr).await;
        Ok(())
    }
}

async fn client_connected(ws: WebSocket, state: Arc<RwLock<State>>) {
    let conn_id = CONNECTION_ID.fetch_add(1, Ordering::Relaxed);

    info!("connected (uid={})", conn_id);

    // Split the socket into a sender and receive of messages.
    let (mut user_ws_tx, mut user_ws_rx) = ws.split();

    // Use an unbounded channel to handle buffering and flushing of messages
    // to the websocket...
    let (tx, rx) = mpsc::unbounded_channel::<Message>();
    let mut rx = UnboundedReceiverStream::new(rx);

    tokio::task::spawn(async move {
        while let Some(message) = rx.next().await {
            user_ws_tx
                .send(message)
                .unwrap_or_else(|e| {
                    eprintln!("websocket send error: {}", e);
                })
                .await;
        }
    });

    // Save the sender in our list of connected clients.
    state.write().await.clients.insert(conn_id, tx);

    // Handle incoming requests from clients
    while let Some(result) = user_ws_rx.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                error!("websocket rx error (uid={}): {}", conn_id, e);
                break;
            }
        };
        client_incoming_message(conn_id, msg, &state).await;
    }

    // user_ws_rx stream will keep processing as long as the user stays
    // connected. Once they disconnect, then...
    client_disconnected(conn_id, &state).await;
}

async fn client_incoming_message(
    conn_id: usize,
    msg: Message,
    state: &Arc<RwLock<State>>,
) {
    let msg = if let Ok(s) = msg.to_str() {
        s
    } else {
        return;
    };

    match json_rpc2::from_str(msg) {
        Ok(req) => rpc_request(conn_id, req, state).await,
        Err(e) => warn!("websocket rx JSON error (uid={}): {}", conn_id, e),
    }
}

/// Process a request message from a client.
async fn rpc_request(
    conn_id: usize,
    request: Request,
    state: &Arc<RwLock<State>>,
) {
    use json_rpc2::futures::*;

    let service: Box<dyn Service<Data = (usize, Arc<RwLock<State>>)>> =
        Box::new(ServiceHandler {});
    let server = Server::new(vec![&service]);

    if let Some(response) =
        server.serve(&request, &(conn_id, Arc::clone(state))).await
    {
        rpc_response(conn_id, &response, state).await;
    }

    // Requests that require post-processing notifications
    match request.method() {
        SESSION_CREATE | SESSION_SIGNUP | SESSION_LOAD | PEER_RELAY
        | NOTIFY_ADDRESS | NOTIFY_PROPOSAL => {
            rpc_notify(conn_id, &request, state).await;
        }
        _ => {}
    }
}

/// Post processing notifications.
async fn rpc_notify(
    conn_id: usize,
    request: &Request,
    state: &Arc<RwLock<State>>,
) {
    use json_rpc2::futures::*;
    let service: Box<
        dyn Service<
            Data = (usize, Arc<RwLock<State>>, Arc<Mutex<NotificationContext>>),
        >,
    > = Box::new(NotifyHandler {});
    let server = Server::new(vec![&service]);

    let notification = Arc::new(Mutex::new(Default::default()));

    if let Some(response) = server
        .serve(
            request,
            &(conn_id, Arc::clone(state), Arc::clone(&notification)),
        )
        .await
    {
        rpc_broadcast(&response, state, notification).await;
    }
}

async fn rpc_broadcast(
    response: &Response,
    state: &Arc<RwLock<State>>,
    notification: Arc<Mutex<NotificationContext>>,
) {
    let reader = state.read().await;
    let mut notification = notification.lock().await;
    if !notification.noop {
        // Explicit list of messages for target clients
        if let Some(messages) = notification.messages.take() {
            for (conn_id, response) in messages {
                rpc_response(conn_id, &response, state).await;
            }
        } else {
            if let Some(group_id) = &notification.group_id {
                let clients = if let Some(group) = reader.groups.get(group_id) {
                    if let Some(session_id) = &notification.session_id {
                        if let Some(session) = group.sessions.get(session_id) {
                            session
                                .party_signups
                                .iter()
                                .map(|i| i.1.clone())
                                .collect()
                        } else {
                            warn!(
                                "notification session {} does not exist",
                                session_id
                            );
                            vec![0usize]
                        }
                    } else {
                        group.clients.clone()
                    }
                } else {
                    vec![0usize]
                };

                for conn_id in clients {
                    if let Some(filter) = &notification.filter {
                        if let Some(_) =
                            filter.iter().find(|conn| **conn == conn_id)
                        {
                            continue;
                        }
                    }
                    rpc_response(conn_id, response, state).await;
                }
            } else {
                warn!("notification context is missing group_id");
            }
        }
    }
}

/// Send a message to a single client.
async fn rpc_response(
    conn_id: usize,
    response: &json_rpc2::Response,
    state: &Arc<RwLock<State>>,
) {
    trace!("send_message (uid={})", conn_id);
    if let Some(tx) = state.read().await.clients.get(&conn_id) {
        let msg = serde_json::to_string(response).unwrap();
        trace!("sending message {:#?}", msg);
        if let Err(_disconnected) = tx.send(Message::text(msg)) {
            // The tx is disconnected, our `client_disconnected` code
            // should be happening in another task, nothing more to
            // do here.
        }
    } else {
        warn!("could not find tx for (uid={})", conn_id);
    }
}

async fn client_disconnected(conn_id: usize, state: &Arc<RwLock<State>>) {
    info!("disconnected (uid={})", conn_id);

    // FIXME: prune session party signups for disconnected clients?

    let mut empty_groups: Vec<String> = Vec::new();
    {
        let mut writer = state.write().await;
        // Stream closed up, so remove from the client list
        writer.clients.remove(&conn_id);
        // Remove the connection from any client groups
        for (key, group) in writer.groups.iter_mut() {
            if let Some(index) =
                group.clients.iter().position(|x| *x == conn_id)
            {
                group.clients.remove(index);
            }

            // Group has no more connected clients so flag it for removal
            if group.clients.is_empty() {
                empty_groups.push(key.clone());
            }
        }
    }

    // Prune empty groups
    let mut writer = state.write().await;
    for key in empty_groups {
        writer.groups.remove(&key);
        info!("removed group {}", &key);
    }
}
