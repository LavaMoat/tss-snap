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
    Entry, Parameters, PartySignup, PeerEntry, SignResult, ROUND_0, ROUND_1,
    ROUND_2, ROUND_3, ROUND_4, ROUND_5, ROUND_6, ROUND_7, ROUND_8, ROUND_9,
};

/// Global unique user id counter.
static NEXT_USER_ID: AtomicUsize = AtomicUsize::new(1);

static BROADCAST_LOCK: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

/// Incoming message from a websocket client.
#[derive(Debug, Deserialize)]
struct Incoming {
    id: Option<usize>,
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
    #[serde(rename = "sign_proposal")]
    SignProposal,
    // Start the signing process by sharing party identifiers
    #[serde(rename = "sign_round0")]
    SignRound0,
    /// Store the round 1 entry sent by each client.
    #[serde(rename = "sign_round1")]
    SignRound1,
    /// Relay round 2 entries peer 2 peer
    #[serde(rename = "sign_round2_relay_peers")]
    SignRound2RelayPeers,
    /// Store the round 3 entry sent by each client.
    #[serde(rename = "sign_round3")]
    SignRound3,
    /// Store the round 4 entry sent by each client.
    #[serde(rename = "sign_round4")]
    SignRound4,
    /// Store the round 5 entry sent by each client.
    #[serde(rename = "sign_round5")]
    SignRound5,
    /// Store the round 6 entry sent by each client.
    #[serde(rename = "sign_round6")]
    SignRound6,
    /// Store the round 7 entry sent by each client.
    #[serde(rename = "sign_round7")]
    SignRound7,
    /// Store the round 8 entry sent by each client.
    #[serde(rename = "sign_round8")]
    SignRound8,
    /// Store the round 9 entry sent by each client.
    #[serde(rename = "sign_round9")]
    SignRound9,
    /// Notify non-participants that a signed message was generated.
    #[serde(rename = "sign_result")]
    SignResult,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
enum PartySignupPhase {
    #[serde(rename = "keygen")]
    Keygen,
    #[serde(rename = "sign")]
    Sign,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
enum IncomingData {
    PartySignup {
        phase: PartySignupPhase,
    },
    Entry {
        entry: Entry,
        uuid: String,
    },
    PeerEntries {
        entries: Vec<PeerEntry>,
    },
    Message {
        message: String,
    },
    SignResult {
        sign_result: SignResult,
        uuid: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
enum OutgoingKind {
    /// Answer sent to a party with the commitments from the other parties
    /// during the keygen phase.
    #[serde(rename = "keygen_commitment_answer")]
    KeygenCommitmentAnswer,
    /// Relayed peer to peer answer.
    #[serde(rename = "keygen_peer_answer")]
    KeygenPeerAnswer,
    /// Broadcast to propose a message to sign.
    #[serde(rename = "sign_proposal")]
    SignProposal,
    /// Broadcast to parties not signing the message to let them know a sign is in progress.
    #[serde(rename = "sign_progress")]
    SignProgress,
    /// Answer sent to a party with the commitments from the other parties
    /// during the sign phase.
    #[serde(rename = "sign_commitment_answer")]
    SignCommitmentAnswer,
    /// Relayed peer to peer answer.
    #[serde(rename = "sign_peer_answer")]
    SignPeerAnswer,
    /// Notify non-participants of a sign result.
    #[serde(rename = "sign_result")]
    SignResult,
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
    PartySignup {
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
    Message {
        message: String,
    },
    SignResult {
        sign_result: SignResult,
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

        let mut static_files = std::env::current_dir()?;
        static_files.pop();
        static_files.push("client");
        static_files.push("dist");

        let client = warp::any().and(warp::fs::dir(static_files));

        let websocket = warp::path(path).and(warp::ws()).and(state).map(
            |ws: warp::ws::Ws, state| {
                ws.on_upgrade(move |socket| client_connected(socket, state))
            },
        );

        let routes = websocket.or(client);

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
                id: req.id,
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
            if let IncomingData::PartySignup { phase } =
                req.data.as_ref().unwrap()
            {
                let total = match phase {
                    PartySignupPhase::Keygen => info.params.parties,
                    PartySignupPhase::Sign => info.params.threshold + 1,
                };

                let party_signup = {
                    let client_signup = &info.party_signup;
                    if client_signup.number < total {
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
                    id: req.id,
                    kind: None,
                    data: Some(OutgoingData::PartySignup { party_signup }),
                })
            } else {
                None
            }
        }
        // Propose a message to be signed
        IncomingKind::SignProposal => {
            if let IncomingData::Message { message } =
                req.data.as_ref().unwrap()
            {
                drop(info);

                let msg = Outgoing {
                    id: None,
                    kind: Some(OutgoingKind::SignProposal),
                    data: Some(OutgoingData::Message {
                        message: message.clone(),
                    }),
                };

                let lock = BROADCAST_LOCK.try_lock();
                if let Ok(_) = lock {
                    broadcast_message(&msg, state).await;
                }

                None
            } else {
                None
            }
        }
        // Store the round Entry
        IncomingKind::KeygenRound1
        | IncomingKind::KeygenRound2
        | IncomingKind::KeygenRound4
        | IncomingKind::KeygenRound5
        | IncomingKind::SignRound0
        | IncomingKind::SignRound1
        | IncomingKind::SignRound3
        | IncomingKind::SignRound4
        | IncomingKind::SignRound5
        | IncomingKind::SignRound6
        | IncomingKind::SignRound7
        | IncomingKind::SignRound8
        | IncomingKind::SignRound9 => {
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
                    id: req.id,
                    kind: None,
                    data: None,
                })
            } else {
                None
            }
        }
        IncomingKind::KeygenRound3RelayPeers
        | IncomingKind::SignRound2RelayPeers => {
            // Send an ACK so the client promise will resolve
            Some(Outgoing {
                id: req.id,
                kind: None,
                data: None,
            })
        }
        // FIXME: this is broadcast multiple times because
        // FIXME: we receive this message from each signer
        IncomingKind::SignResult => {
            if let IncomingData::SignResult { sign_result, uuid } =
                req.data.as_ref().unwrap()
            {
                let info = state.read().await;
                let non_participants: Vec<usize> = info
                    .clients
                    .iter()
                    .filter(|(_k, v)| {
                        if let Some(party_signup) = &v.1 {
                            if &party_signup.uuid != uuid {
                                return true;
                            }
                        }
                        false
                    })
                    .map(|(k, _v)| *k)
                    .collect();
                drop(info);

                let res = Outgoing {
                    id: None,
                    kind: Some(OutgoingKind::SignResult),
                    data: Some(OutgoingData::SignResult {
                        sign_result: sign_result.clone(),
                    }),
                };

                for conn_id in non_participants {
                    send_message(conn_id, &res, state).await;
                }
            }

            None
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
        | IncomingKind::SignRound0
        | IncomingKind::SignRound1
        | IncomingKind::SignRound3
        | IncomingKind::SignRound4
        | IncomingKind::SignRound5
        | IncomingKind::SignRound6
        | IncomingKind::SignRound7
        | IncomingKind::SignRound8
        | IncomingKind::SignRound9 => {
            let info = state.read().await;
            let parties = info.params.parties as usize;
            let threshold = info.params.threshold as usize;
            let num_entries = info.ephemeral_state.len();
            drop(info);

            let required_num_entries = match req.kind {
                IncomingKind::SignRound0
                | IncomingKind::SignRound1
                | IncomingKind::SignRound3
                | IncomingKind::SignRound4
                | IncomingKind::SignRound5
                | IncomingKind::SignRound6
                | IncomingKind::SignRound7
                | IncomingKind::SignRound8
                | IncomingKind::SignRound9 => threshold + 1,
                IncomingKind::KeygenRound1
                | IncomingKind::KeygenRound2
                | IncomingKind::KeygenRound4
                | IncomingKind::KeygenRound5 => parties,
                _ => unreachable!(),
            };

            // Got all the party round commitments so broadcast
            // to each client with the answer vectors
            if num_entries == required_num_entries {
                let round =
                    match req.kind {
                        IncomingKind::SignRound0 => ROUND_0,
                        IncomingKind::KeygenRound1
                        | IncomingKind::SignRound1 => ROUND_1,
                        IncomingKind::KeygenRound2 => ROUND_2,
                        IncomingKind::SignRound3 => ROUND_3,
                        IncomingKind::KeygenRound4
                        | IncomingKind::SignRound4 => ROUND_4,
                        IncomingKind::KeygenRound5
                        | IncomingKind::SignRound5 => ROUND_5,
                        IncomingKind::SignRound6 => ROUND_6,
                        IncomingKind::SignRound7 => ROUND_7,
                        IncomingKind::SignRound8 => ROUND_8,
                        IncomingKind::SignRound9 => ROUND_9,
                        _ => unreachable!(),
                    };

                if let IncomingData::Entry { uuid, .. } =
                    req.data.as_ref().unwrap()
                {
                    // Round 0 only exists for the sign phase
                    if round == ROUND_0 {
                        let mut non_signing_clients: Vec<usize> = Vec::new();
                        {
                            let mut writer = state.write().await;
                            writer.clients.iter_mut().for_each(|(k, v)| {
                                if let Some(mut party_signup) = v.1.as_mut() {
                                    // Got a connection that is not participating
                                    // in the signing phase, we need to set the party
                                    // number to zero otherwise there are collisions
                                    // betweeen parties participating in the signing and
                                    // stale party signup numbers from the key generation
                                    // phase. These collisions would cause broadcast messages
                                    // to go to the wrong recipients due to the simple logic
                                    // for associating a connection with a party number.
                                    if &party_signup.uuid != uuid {
                                        party_signup.number = 0;
                                        non_signing_clients.push(*k);
                                    }
                                }
                            })
                        }

                        // Notify non-participants that signing is in progress
                        for conn_id in non_signing_clients {
                            let res = Outgoing {
                                id: None,
                                kind: Some(OutgoingKind::SignProgress),
                                data: None,
                            };
                            send_message(conn_id, &res, state).await;
                        }
                    }

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
                                let kind = match req.kind {
                                    IncomingKind::KeygenRound1
                                    | IncomingKind::KeygenRound2
                                    | IncomingKind::KeygenRound4
                                    | IncomingKind::KeygenRound5 => {
                                        OutgoingKind::KeygenCommitmentAnswer
                                    }
                                    IncomingKind::SignRound0
                                    | IncomingKind::SignRound1
                                    | IncomingKind::SignRound3
                                    | IncomingKind::SignRound4
                                    | IncomingKind::SignRound5
                                    | IncomingKind::SignRound6
                                    | IncomingKind::SignRound7
                                    | IncomingKind::SignRound8
                                    | IncomingKind::SignRound9 => {
                                        OutgoingKind::SignCommitmentAnswer
                                    }
                                    _ => unreachable!(),
                                };

                                let res = Outgoing {
                                    id: None,
                                    kind: Some(kind),
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
        IncomingKind::KeygenRound3RelayPeers
        | IncomingKind::SignRound2RelayPeers => {
            if let IncomingData::PeerEntries { entries } = req.data.unwrap() {
                let kind = match req.kind {
                    IncomingKind::KeygenRound3RelayPeers => {
                        OutgoingKind::KeygenPeerAnswer
                    }
                    IncomingKind::SignRound2RelayPeers => {
                        OutgoingKind::SignPeerAnswer
                    }
                    _ => unreachable!(),
                };

                for entry in entries {
                    if let Some(conn_id) =
                        conn_id_for_party(state, entry.party_to).await
                    {
                        let res = Outgoing {
                            id: None,
                            kind: Some(kind),
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

/// Broadcast a message to all clients.
async fn broadcast_message(res: &Outgoing, state: &Arc<RwLock<State>>) {
    let info = state.read().await;
    let clients: Vec<usize> = info.clients.keys().cloned().collect();
    drop(info);
    for conn_id in clients {
        send_message(conn_id, res, state).await;
    }
}

async fn round_commitment_answers(
    state: &Arc<RwLock<State>>,
    //parties: u16,
    party_num: u16,
    round: &str,
    sender_uuid: String,
) -> Vec<String> {
    let info = state.read().await;
    let parties: u16 = info.params.parties;
    let mut ans_vec = Vec::new();
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
