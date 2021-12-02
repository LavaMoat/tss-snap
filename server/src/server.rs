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
use uuid::Uuid;
use warp::ws::{Message, WebSocket};
use warp::Filter;

use std::convert::TryInto;

use super::state_machine::*;

use common::{Entry, Key, PartySignup, ROUND_1};

/// Global unique user id counter.
static NEXT_USER_ID: AtomicUsize = AtomicUsize::new(1);

static PHASES: Lazy<Vec<Phase>> =
    Lazy::new(|| vec![Phase::Standby, Phase::Keygen, Phase::Signing]);

/// Parameters for key generation and signing.
#[derive(Debug, Serialize, Deserialize)]
pub struct Parameters {
    pub parties: u16,
    pub threshold: u16,
}

/// Incoming message from a websocket client.
#[derive(Debug, Deserialize)]
struct Incoming {
    id: usize,
    kind: IncomingKind,
    data: Option<IncomingData>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
enum IncomingKind {
    /// Get the parameters.
    #[serde(rename = "parameters")]
    Parameters,
    /// Initoalize the key generation process with a signup
    #[serde(rename = "keygen_signup")]
    KeygenSignup,
    /// All clients send this message once `keygen_signup` is complete
    /// to store the entry state on the server
    #[serde(rename = "keygen_signup_entry")]
    KeygenSignupEntry,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
enum IncomingData {
    Entry { entry: Entry, uuid: String },
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
enum OutgoingKind {
    /// Answer sent to a party with the commitments from the other parties.
    #[serde(rename = "commitment_answer")]
    CommitmentAnswer,
}

#[derive(Debug, Serialize)]
struct Outgoing {
    id: Option<usize>,
    kind: Option<OutgoingKind>,
    data: Option<OutgoingData>,
}

/// Outgoing data sent to a websocket client.
#[derive(Debug, Serialize)]
#[serde(untagged)]
enum OutgoingData {
    /// Sent when a client connects so they know
    /// the number of paramters.
    Parameters {
        parties: u16,
        threshold: u16,
    },
    KeygenSignup {
        party_signup: PartySignup,
    },
    CommitmentAnswer {
        round: String,
        answer: Vec<String>,
    },
}

#[derive(Debug)]
struct State<'a> {
    /// Initial parameters.
    params: Parameters,
    /// Connected clients.
    clients:
        HashMap<usize, (mpsc::UnboundedSender<Message>, Option<PartySignup>)>,
    /// Current state machine phase.
    phase: Phase,
    /// The state machine.
    machine: PhaseIterator<'a>,
    /// Current keygen signup state.
    keygen_signup: PartySignup,
    /// Map of key / values broadcast to the server by clients
    keys: HashMap<Key, String>,
}

pub struct Server;

impl Server {
    pub async fn start(
        path: &'static str,
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
            keygen_signup: PartySignup {
                number: 0,
                uuid: Uuid::new_v4().to_string(),
            },
            keys: Default::default(),
            phase: Default::default(),
            machine,
        }));
        let state = warp::any().map(move || state.clone());

        let routes = warp::path(path).and(warp::ws()).and(state).map(
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
    state.write().await.clients.insert(conn_id, (tx, None));

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

    match serde_json::from_str::<Incoming>(msg) {
        Ok(req) => client_request(conn_id, req, state).await,
        Err(e) => warn!("websocket rx JSON error (uid={}): {}", conn_id, e),
    }
}

/// Process a request message from a client.
async fn client_request(
    conn_id: usize,
    req: Incoming,
    state: &Arc<RwLock<State<'_>>>,
) {
    let info = state.read().await;
    trace!("processing request {:#?}", req);
    let response: Option<Outgoing> = match req.kind {
        // Handshake gets the parameters the server was started with
        IncomingKind::Parameters => {
            let parties = info.params.parties;
            let threshold = info.params.threshold;
            drop(info);

            Some(Outgoing {
                id: Some(req.id),
                kind: None,
                data: Some(OutgoingData::Parameters { parties, threshold }),
            })
        }
        // Signup creates a PartySignup
        IncomingKind::KeygenSignup => {
            let party_signup = {
                let client_signup = &info.keygen_signup;
                if client_signup.number < info.params.parties {
                    PartySignup {
                        number: client_signup.number + 1,
                        uuid: client_signup.uuid.clone(),
                    }
                } else {
                    PartySignup {
                        number: 1,
                        uuid: Uuid::new_v4().to_string(),
                    }
                }
            };

            drop(info);
            let mut writer = state.write().await;
            writer.keygen_signup = party_signup.clone();

            let conn_info = writer.clients.get_mut(&conn_id).unwrap();
            conn_info.1 = Some(party_signup.clone());

            Some(Outgoing {
                id: Some(req.id),
                kind: None,
                data: Some(OutgoingData::KeygenSignup { party_signup }),
            })
        }
        // Store the Entry
        IncomingKind::KeygenSignupEntry => {
            // Assume the client is well behaved and sends the request data
            let IncomingData::Entry { entry, .. } = req.data.as_ref().unwrap();

            // Store the key state broadcast by the client
            drop(info);
            let mut writer = state.write().await;
            writer.keys.insert(entry.key.clone(), entry.value.clone());

            // Send an ACK so the client promise will resolve
            Some(Outgoing {
                id: Some(req.id),
                kind: None,
                data: None,
            })
        }
    };

    if let Some(res) = response {
        send_message(conn_id, &res, state).await;
    }

    // Post processing after sending response
    match req.kind {
        IncomingKind::KeygenSignupEntry => {
            let info = state.read().await;
            let parties = info.params.parties as usize;
            let num_keys = info.keys.len();
            drop(info);

            let IncomingData::Entry { uuid, .. } = req.data.as_ref().unwrap();

            // Got all the party round 1 commitments so broadcast
            // to each client with the answer vectors including an
            // Entry for each other party
            if num_keys == parties {
                trace!("got all round1 commitments, broadcasting answers");

                for i in 0..parties {
                    let party_num: u16 = (i + 1).try_into().unwrap();
                    let ans_vec = round_commitment_answers(
                        state,
                        party_num,
                        ROUND_1,
                        uuid.clone(),
                    )
                    .await;

                    if let Some(conn_id) =
                        conn_id_for_party(state, party_num).await
                    {
                        let res = Outgoing {
                            id: None,
                            kind: Some(OutgoingKind::CommitmentAnswer),
                            data: Some(OutgoingData::CommitmentAnswer {
                                round: ROUND_1.to_string(),
                                answer: ans_vec,
                            }),
                        };
                        send_message(conn_id, &res, state).await;
                    }

                    //println!("got ans_vec {:#?}", ans_vec);
                    //println!("got answer conn_id {:#?}", conn_id);
                }
            }
        }
        _ => {}
    }
}

/// Send a message to a single client.
async fn send_message(
    conn_id: usize,
    res: &Outgoing,
    state: &Arc<RwLock<State<'_>>>,
) {
    trace!("send_message (uid={})", conn_id);
    if let Some((tx, _)) = state.read().await.clients.get(&conn_id) {
        let msg = serde_json::to_string(res).unwrap();
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

/// Broadcast a message to all clients.
async fn broadcast_message(res: &Outgoing, state: &Arc<RwLock<State<'_>>>) {
    let info = state.read().await;
    let clients: Vec<usize> = info.clients.keys().cloned().collect();
    drop(info);
    for conn_id in clients {
        send_message(conn_id, res, state).await;
    }
}

async fn round_commitment_answers(
    state: &Arc<RwLock<State<'_>>>,
    party_num: u16,
    round: &str,
    sender_uuid: String,
) -> Vec<String> {
    let mut ans_vec = Vec::new();
    let info = state.read().await;
    let parties = info.params.parties;
    for i in 1..=parties {
        if i != party_num {
            let key = format!("{}-{}-{}", i, round, sender_uuid);
            let value = info.keys.get(&key);
            if let Some(value) = value {
                trace!("[{:?}] party {:?} => party {:?}", round, i, party_num);
                ans_vec.push(value.clone());
            }
        }
    }
    ans_vec
}

async fn client_disconnected(conn_id: usize, state: &Arc<RwLock<State<'_>>>) {
    info!("disconnected (uid={})", conn_id);
    // Stream closed up, so remove from the client list
    state.write().await.clients.remove(&conn_id);
}

async fn conn_id_for_party(
    state: &Arc<RwLock<State<'_>>>,
    party_num: u16,
) -> Option<usize> {
    let info = state.read().await;
    info.clients.iter().find_map(|(k, v)| {
        if let Some(party_signup) = &v.1 {
            if party_signup.number == party_num {
                Some(k.clone())
            } else {
                None
            }
        } else {
            None
        }
    })
}
