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
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio_stream::wrappers::UnboundedReceiverStream;
use uuid::Uuid;
use warp::ws::{Message, WebSocket};
use warp::Filter;

use std::convert::TryInto;

use common::{
    Entry, Parameters, PartySignup, PeerEntry, ROUND_0, ROUND_1, ROUND_2,
    ROUND_3, ROUND_4, ROUND_5,
};

/// Global unique user id counter.
static NEXT_USER_ID: AtomicUsize = AtomicUsize::new(1);

static BROADCAST_LOCK: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

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
    /// Initialize the key generation process with a party signup
    #[serde(rename = "party_signup")]
    PartySignup,
    /// All clients send this message once `party_signup` is complete
    /// to store the round 1 entry
    #[serde(rename = "keygen_round1")]
    KeygenRound1,
    /// Store the round 2 entry sent by each client.
    #[serde(rename = "keygen_round2")]
    KeygenRound2,
    /// Relay round 3 entries peer 2 peer
    #[serde(rename = "keygen_round3_relay_peers")]
    KeygenRound3RelayPeers,
    /// Store the round 4 entry sent by each client.
    #[serde(rename = "keygen_round4")]
    KeygenRound4,
    /// Store the round 5 entry sent by each client.
    #[serde(rename = "keygen_round5")]
    KeygenRound5,

    // Start the signing process by sharing party identifiers
    #[serde(rename = "sign_round0")]
    SignRound0,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
enum IncomingData {
    Entry { entry: Entry, uuid: String },
    PeerEntries { entries: Vec<PeerEntry> },
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
enum OutgoingKind {
    /// Answer sent to a party with the commitments from the other parties.
    #[serde(rename = "commitment_answer")]
    CommitmentAnswer,
    /// Relayed peer to peer answer.
    #[serde(rename = "peer_answer")]
    PeerAnswer,
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
        conn_id: usize,
    },
    KeygenSignup {
        party_signup: PartySignup,
    },
    CommitmentAnswer {
        round: String,
        answer: Vec<String>,
    },
    PeerAnswer {
        round: String,
        peer_entry: PeerEntry,
    },
}

#[derive(Debug)]
struct State {
    /// Initial parameters.
    params: Parameters,
    /// Connected clients.
    clients:
        HashMap<usize, (mpsc::UnboundedSender<Message>, Option<PartySignup>)>,
    /// Current keygen signup state.
    party_signup: PartySignup,
    /// Map of key / values sent to the server by clients for ephemeral states
    ephemeral_state: HashMap<String, String>,
}

pub struct Server;

impl Server {
    pub async fn start(
        path: &'static str,
        addr: impl Into<SocketAddr>,
        params: Parameters,
    ) -> Result<()> {
        let state = Arc::new(RwLock::new(State {
            params,
            clients: HashMap::new(),
            party_signup: PartySignup {
                number: 0,
                uuid: Uuid::new_v4().to_string(),
            },
            ephemeral_state: Default::default(),
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

async fn client_connected(ws: WebSocket, state: Arc<RwLock<State>>) {
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
    state: &Arc<RwLock<State>>,
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
    state: &Arc<RwLock<State>>,
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
                data: Some(OutgoingData::Parameters {
                    parties,
                    threshold,
                    conn_id,
                }),
            })
        }
        // Signup creates a PartySignup
        IncomingKind::PartySignup => {
            let party_signup = {
                let client_signup = &info.party_signup;
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
            writer.party_signup = party_signup.clone();

            let conn_info = writer.clients.get_mut(&conn_id).unwrap();
            conn_info.1 = Some(party_signup.clone());

            Some(Outgoing {
                id: Some(req.id),
                kind: None,
                data: Some(OutgoingData::KeygenSignup { party_signup }),
            })
        }
        // Store the round 1 Entry
        IncomingKind::KeygenRound1
        | IncomingKind::KeygenRound2
        | IncomingKind::KeygenRound4
        | IncomingKind::KeygenRound5
        | IncomingKind::SignRound0 => {
            // Assume the client is well behaved and sends the request data
            if let IncomingData::Entry { entry, .. } =
                req.data.as_ref().unwrap()
            {
                // Store the key state broadcast by the client
                drop(info);
                let mut writer = state.write().await;
                writer
                    .ephemeral_state
                    .insert(entry.key.clone(), entry.value.clone());

                // Send an ACK so the client promise will resolve
                Some(Outgoing {
                    id: Some(req.id),
                    kind: None,
                    data: None,
                })
            } else {
                None
            }
        }
        IncomingKind::KeygenRound3RelayPeers => {
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
        IncomingKind::KeygenRound1
        | IncomingKind::KeygenRound2
        | IncomingKind::KeygenRound4
        | IncomingKind::KeygenRound5
        | IncomingKind::SignRound0 => {
            let info = state.read().await;
            let parties = info.params.parties as usize;
            let threshold = info.params.threshold as usize;
            let num_entries = info.ephemeral_state.len();
            drop(info);

            let required_num_entries = match req.kind {
                IncomingKind::SignRound0 => threshold + 1,
                IncomingKind::KeygenRound1
                | IncomingKind::KeygenRound2
                | IncomingKind::KeygenRound4
                | IncomingKind::KeygenRound5 => parties,
                _ => unreachable!(),
            };

            // Got all the party round commitments so broadcast
            // to each client with the answer vectors
            if num_entries == required_num_entries {
                let round = match req.kind {
                    IncomingKind::SignRound0 => ROUND_0,
                    IncomingKind::KeygenRound1 => ROUND_1,
                    IncomingKind::KeygenRound2 => ROUND_2,
                    IncomingKind::KeygenRound4 => ROUND_4,
                    IncomingKind::KeygenRound5 => ROUND_5,
                    _ => unreachable!(),
                };

                if let IncomingData::Entry { uuid, .. } =
                    req.data.as_ref().unwrap()
                {
                    let lock = BROADCAST_LOCK.try_lock();
                    if let Ok(_) = lock {
                        trace!(
                            "got all {} commitments, broadcasting answers",
                            round
                        );

                        for i in 0..parties {
                            let party_num: u16 = (i + 1).try_into().unwrap();
                            let ans_vec = round_commitment_answers(
                                state,
                                party_num,
                                round,
                                uuid.clone(),
                            )
                            .await;

                            if let Some(conn_id) =
                                conn_id_for_party(state, party_num).await
                            {
                                let res = Outgoing {
                                    id: None,
                                    kind: Some(OutgoingKind::CommitmentAnswer),
                                    data: Some(
                                        OutgoingData::CommitmentAnswer {
                                            round: round.to_string(),
                                            answer: ans_vec,
                                        },
                                    ),
                                };
                                send_message(conn_id, &res, state).await;
                            }
                        }

                        // We just sent commitments to all clients for the round
                        // so clean up the temporary state
                        {
                            let mut writer = state.write().await;
                            // TODO: zeroize the state information
                            writer.ephemeral_state = Default::default();
                        }
                    }
                }
            }
        }
        IncomingKind::KeygenRound3RelayPeers => {
            if let IncomingData::PeerEntries { entries } = req.data.unwrap() {
                for entry in entries {
                    if let Some(conn_id) =
                        conn_id_for_party(state, entry.party_to).await
                    {
                        let res = Outgoing {
                            id: None,
                            kind: Some(OutgoingKind::PeerAnswer),
                            data: Some(OutgoingData::PeerAnswer {
                                round: ROUND_3.to_string(),
                                peer_entry: entry,
                            }),
                        };

                        send_message(conn_id, &res, state).await;
                    }
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
    state: &Arc<RwLock<State>>,
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

/*
/// Broadcast a message to all clients.
async fn broadcast_message(res: &Outgoing, state: &Arc<RwLock<State<'_>>>) {
    let info = state.read().await;
    let clients: Vec<usize> = info.clients.keys().cloned().collect();
    drop(info);
    for conn_id in clients {
        send_message(conn_id, res, state).await;
    }
}
*/

async fn round_commitment_answers(
    state: &Arc<RwLock<State>>,
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
            let value = info.ephemeral_state.get(&key);
            if let Some(value) = value {
                trace!("[{:?}] party {:?} => party {:?}", round, i, party_num);
                ans_vec.push(value.clone());
            }
        }
    }
    ans_vec
}

async fn client_disconnected(conn_id: usize, state: &Arc<RwLock<State>>) {
    info!("disconnected (uid={})", conn_id);
    // Stream closed up, so remove from the client list
    state.write().await.clients.remove(&conn_id);
}

async fn conn_id_for_party(
    state: &Arc<RwLock<State>>,
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
