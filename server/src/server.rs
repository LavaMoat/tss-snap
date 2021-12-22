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
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio_stream::wrappers::UnboundedReceiverStream;
use uuid::Uuid;
use warp::http::header::{HeaderMap, HeaderValue};
use warp::ws::{Message, WebSocket};
use warp::Filter;

use common::{Parameters, PartySignup, PeerEntry, SignResult};

/// Global unique connection id counter.
static CONNECTION_ID: AtomicUsize = AtomicUsize::new(1);

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
    /// Relay a message to peers.
    #[serde(rename = "peer_relay")]
    PeerRelay,
    // Start the signing process by sharing party identifiers
    #[serde(rename = "sign_proposal")]
    SignProposal,
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
    /// Relayed peer to peer answer.
    #[serde(rename = "peer_relay")]
    PeerRelay,
    /// Broadcast to indicate party signup is completed.
    #[serde(rename = "party_signup")]
    PartySignup,
    /// Broadcast to propose a message to sign.
    #[serde(rename = "sign_proposal")]
    SignProposal,
    /// Broadcast to parties not signing the message to let them know a sign is in progress.
    #[serde(rename = "sign_progress")]
    SignProgress,
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
    PeerAnswer {
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
    // TODO: remove uuid when we have signup groups
    /// UUID of the last party signup
    uuid: String,
    /// Store party signups so we know when they have all been received
    party_signups: HashMap<u16, String>,
}

pub struct Server;

impl Server {
    pub async fn start(
        path: &'static str,
        addr: impl Into<SocketAddr>,
        params: Parameters,
        static_files: Option<PathBuf>,
    ) -> Result<()> {
        let state = Arc::new(RwLock::new(State {
            params,
            clients: HashMap::new(),
            uuid: String::new(),
            party_signups: Default::default(),
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
                let (party_signup, uuid) = {
                    let last = info.party_signups.iter().last();
                    if last.is_none() {
                        let uuid = Uuid::new_v4().to_string();
                        (
                            PartySignup {
                                number: 1,
                                uuid: uuid.clone(),
                            },
                            uuid,
                        )
                    } else {
                        let (num, uuid) = last.unwrap();
                        (
                            PartySignup {
                                number: num + 1,
                                uuid: uuid.clone(),
                            },
                            uuid.clone(),
                        )
                    }
                };

                drop(info);
                let mut writer = state.write().await;
                writer.uuid = uuid;
                writer
                    .party_signups
                    .insert(party_signup.number, party_signup.uuid.clone());

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
        IncomingKind::PeerRelay => {
            // Nothing to do for peer relays - no response
            None
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
        IncomingKind::PartySignup => {
            let info = state.read().await;
            let parties = info.params.parties as usize;
            let threshold = info.params.threshold as usize;
            let num_entries = info.party_signups.len();
            drop(info);
            let required_num_entries =
                if let Some(IncomingData::PartySignup { phase }) =
                    req.data.as_ref()
                {
                    match phase {
                        PartySignupPhase::Keygen => parties,
                        PartySignupPhase::Sign => threshold + 1,
                    }
                } else {
                    0
                };

            if num_entries == required_num_entries {
                let msg = Outgoing {
                    id: None,
                    kind: Some(OutgoingKind::PartySignup),
                    data: None,
                };

                // Notify the non-participants
                if let Some(IncomingData::PartySignup { phase }) =
                    req.data.as_ref()
                {
                    if let PartySignupPhase::Sign = phase {
                        let mut non_signing_clients: Vec<usize> = Vec::new();
                        {
                            let mut writer = state.write().await;
                            let uuid = writer.uuid.clone();
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
                                    if party_signup.uuid != uuid {
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
                }

                let parties: Vec<u16> = {
                    let info = state.read().await;
                    info.party_signups.keys().cloned().collect()
                };

                let lock = BROADCAST_LOCK.try_lock();
                if let Ok(_) = lock {
                    for party_num in parties {
                        if let Some(conn_id) =
                            conn_id_for_party(state, party_num).await
                        {
                            send_message(conn_id, &msg, state).await;
                        }
                    }

                    {
                        let mut writer = state.write().await;
                        writer.party_signups = Default::default();
                    }
                }
            }
        }
        IncomingKind::PeerRelay => {
            if let IncomingData::PeerEntries { entries } = req.data.unwrap() {
                let kind = match req.kind {
                    IncomingKind::PeerRelay => OutgoingKind::PeerRelay,
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
                                peer_entry: entry,
                            }),
                        };

                        send_message(conn_id, &res, state).await;
                    } else {
                        eprintln!(
                            "failed to find conn_id for {}",
                            entry.party_to
                        );
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
