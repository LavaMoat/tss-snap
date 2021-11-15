use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

use anyhow::Result;
use futures_util::{FutureExt, StreamExt};
use tokio::sync::{mpsc, RwLock};
use tokio_stream::wrappers::UnboundedReceiverStream;
use warp::ws::{Message, WebSocket};
use warp::Filter;

use serde::{Deserialize, Serialize};

/// Global unique user id counter.
static NEXT_USER_ID: AtomicUsize = AtomicUsize::new(1);

/// Parameters for key generation and signing.
#[derive(Debug, Serialize, Deserialize)]
pub struct Parameters {
    pub parties: u16,
    pub threshold: u16,
}

#[derive(Debug)]
struct State {
    params: Parameters,
    clients: HashMap<usize, mpsc::UnboundedSender<Message>>,
}

pub struct Server;

impl Server {
    pub async fn start(addr: impl Into<SocketAddr>, params: Parameters) -> Result<()> {
        let state = Arc::new(RwLock::new(State { params, clients: HashMap::new() }));
        let state = warp::any().map(move || state.clone());

        let routes =
            warp::path("ws")
                .and(warp::ws())
                .and(state)
                .map(|ws: warp::ws::Ws, state| {
                    ws.on_upgrade(move |socket| user_connected(socket, state))
                });
        warp::serve(routes).run(addr).await;
        Ok(())
    }
}

async fn user_connected(ws: WebSocket, state: Arc<RwLock<State>>) {
    let conn_id = NEXT_USER_ID.fetch_add(1, Ordering::Relaxed);

    eprintln!("connected: {}", conn_id);

    // Split the socket into a sender and receive of messages.
    let (mut user_ws_tx, mut user_ws_rx) = ws.split();

    // Use an unbounded channel to handle buffering and flushing of messages
    // to the websocket...
    let (tx, rx) = mpsc::unbounded_channel::<Message>();
    let mut rx = UnboundedReceiverStream::new(rx);

    // Save the sender in our list of connected users.
    state.write().await.clients.insert(conn_id, tx);

    // Every time the user sends a message, broadcast it to
    // all other users...
    while let Some(result) = user_ws_rx.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                eprintln!("websocket error(uid={}): {}", conn_id, e);
                break;
            }
        };
        user_message(conn_id, msg, &state).await;
    }

    // user_ws_rx stream will keep processing as long as the user stays
    // connected. Once they disconnect, then...
    user_disconnected(conn_id, &state).await;
}

async fn user_message(conn_id: usize, msg: Message, state: &Arc<RwLock<State>>) {
    // TODO
}

async fn user_disconnected(conn_id: usize, state: &Arc<RwLock<State>>) {
    eprintln!("disconnected: {}", conn_id);

    // Stream closed up, so remove from the client list
    state.write().await.clients.remove(&conn_id);
}
