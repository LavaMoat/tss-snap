use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

use anyhow::Result;
use futures_util::{SinkExt, StreamExt, TryFutureExt};
use log::{error, info, trace, warn};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, RwLock};
use tokio_stream::wrappers::UnboundedReceiverStream;
use warp::ws::{Message, WebSocket};
use warp::Filter;

use super::state_machine::*;

/// Global unique user id counter.
static NEXT_USER_ID: AtomicUsize = AtomicUsize::new(1);

static PHASES: Lazy<Vec<Phase>> = Lazy::new(|| {
    vec![Phase::Standby, Phase::Keygen, Phase::Signing]
});

/// Parameters for key generation and signing.
#[derive(Debug, Serialize, Deserialize)]
pub struct Parameters {
    pub parties: u16,
    pub threshold: u16,
}

/// Request from a websocket client.
#[derive(Debug, Deserialize)]
struct Request {
    kind: RequestKind,
}

#[derive(Debug, Deserialize)]
enum RequestKind {
    /// Get the parameters.
    #[serde(rename = "parameters")]
    Parameters,
}

/// Request from a websocket client.
#[derive(Debug, Serialize)]
#[serde(untagged)]
enum Response {
    /// Sent when a client connects so they know
    /// the number of paramters.
    Parameters { parties: u16, threshold: u16 },
}

#[derive(Debug)]
struct State<'a> {
    /// Initial parameters.
    params: Parameters,
    /// Connected clients.
    clients: HashMap<usize, mpsc::UnboundedSender<Message>>,
    /// Current state machine phase.
    phase: Phase,
    /// The state machine.
    machine: PhaseIterator<'a>,
}

pub struct Server;

impl Server {
    pub async fn start(
        addr: impl Into<SocketAddr>,
        params: Parameters,
    ) -> Result<()> {
        let machine = PhaseIterator {
            phases: &PHASES,
            index: 0,
        };

        let state = Arc::new(RwLock::new(State {
            params,
            clients: HashMap::new(),
            phase: Default::default(),
            machine,
        }));
        let state = warp::any().map(move || state.clone());

        let routes = warp::path("ws").and(warp::ws()).and(state).map(
            |ws: warp::ws::Ws, state| {
                ws.on_upgrade(move |socket| client_connected(socket, state))
            },
        );
        warp::serve(routes).run(addr).await;
        Ok(())
    }
}

async fn client_connected(ws: WebSocket, state: Arc<RwLock<State<'_>>>) {
    let conn_id = NEXT_USER_ID.fetch_add(1, Ordering::Relaxed);

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
    state: &Arc<RwLock<State<'_>>>,
) {
    let msg = if let Ok(s) = msg.to_str() {
        s
    } else {
        return;
    };

    match serde_json::from_str::<Request>(msg) {
        Ok(req) => client_request(conn_id, req, &state).await,
        Err(e) => warn!("websocket rx JSON error (uid={}): {}", conn_id, e),
    }
}

/// Process a request message from a client.
async fn client_request(
    conn_id: usize,
    req: Request,
    state: &Arc<RwLock<State<'_>>>,
) {
    let info = state.read().await;
    trace!("processing request {:#?}", req);
    let response: Option<Response> = match req.kind {
        RequestKind::Parameters => {
            let res = Response::Parameters {
                parties: info.params.parties,
                threshold: info.params.threshold,
            };
            Some(res)
        }
    };

    if let Some(res) = response {
        send_client_response(conn_id, res, state).await;
    }
}

/// Send a response to a single client.
async fn send_client_response(
    conn_id: usize,
    res: Response,
    state: &Arc<RwLock<State<'_>>>,
) {
    if let Some(tx) = state.read().await.clients.get(&conn_id) {
        let msg = serde_json::to_string(&res).unwrap();
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

async fn client_disconnected(conn_id: usize, state: &Arc<RwLock<State<'_>>>) {
    info!("disconnected (uid={})", conn_id);
    // Stream closed up, so remove from the client list
    state.write().await.clients.remove(&conn_id);
}
