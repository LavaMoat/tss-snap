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
    /// Create a group.
    #[serde(rename = "group_create")]
    GroupCreate,

    /// Join a group.
    #[serde(rename = "group_join")]
    GroupJoin,

    /// Create a session.
    #[serde(rename = "session_create")]
    SessionCreate,

    /*
    /// Get the parameters.
    #[serde(rename = "parameters")]
    Parameters,
    */
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
enum Phase {
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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
enum IncomingData {
    GroupCreate {
        label: String,
        params: Parameters,
    },
    GroupJoin {
        uuid: String,
    },
    SessionCreate {
        group_id: String,
        phase: Phase,
    },
    PartySignup {
        phase: Phase,
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
    /// Send group create reply.
    #[serde(rename = "group_create")]
    GroupCreate,

    /// Send session create reply.
    #[serde(rename = "session_create")]
    SessionCreate,

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
    GroupCreate { uuid: String },
    GroupJoin { group: Group },
    SessionCreate { session: Session },
    PartySignup { party_signup: PartySignup },
    PeerAnswer { peer_entry: PeerEntry },
    Message { message: String },
    SignResult { sign_result: SignResult },
}

#[derive(Debug, Default, Clone, Serialize)]
struct Group {
    uuid: String,
    params: Parameters,
    label: String,
    #[serde(skip)]
    clients: Vec<usize>,
    #[serde(skip)]
    sessions: HashMap<String, Session>,
}

impl Group {
    fn new(conn: usize, params: Parameters, label: String) -> Self {
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
struct Session {
    uuid: String,
    phase: Phase,

    #[serde(skip)]
    party_signups: Vec<(u16, usize)>,
    //params: Parameters,
}

impl Default for Session {
    fn default() -> Self {
        Self {
            uuid: Uuid::new_v4().to_string(),
            party_signups: Default::default(),
            phase: Default::default(),
        }
    }
}

impl From<Phase> for Session {
    fn from(phase: Phase) -> Session {
        Self {
            uuid: Uuid::new_v4().to_string(),
            party_signups: Default::default(),
            phase,
        }
    }
}

impl Session {
    fn signup(&mut self, conn: usize) -> PartySignup {
        let last = self.party_signups.last();
        let num = if last.is_none() {
            1
        } else {
            let (num, _) = last.unwrap();
            num + 1
        };
        self.party_signups.push((num, conn));
        PartySignup {
            number: num,
            uuid: self.uuid.clone(),
        }
    }
}

#[derive(Debug)]
struct State {
    /// Connected clients.
    clients:
        HashMap<usize, (mpsc::UnboundedSender<Message>, Option<PartySignup>)>,
    /// Groups keyed by unique identifier (UUID)
    groups: HashMap<String, Group>,

    /// Initial parameters.
    #[deprecated]
    params: Parameters,
    // TODO: remove uuid when we have signup groups
    /// UUID of the last party signup
    #[deprecated]
    uuid: String,
    /// Store party signups so we know when they have all been received
    #[deprecated]
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
            clients: HashMap::new(),
            groups: Default::default(),
            // TODO: remove these old fields later
            params,
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
    trace!("processing request {:#?}", req);
    let response: Option<Outgoing> = match req.kind {
        // Create a group
        IncomingKind::GroupCreate => {
            if let IncomingData::GroupCreate { label, params } =
                req.data.as_ref().unwrap()
            {
                let group = Group::new(conn_id, params.clone(), label.clone());
                let group_key = group.uuid.clone();
                let uuid = group.uuid.clone();
                let mut writer = state.write().await;
                writer.groups.insert(group_key, group);

                Some(Outgoing {
                    id: req.id,
                    kind: None,
                    data: Some(OutgoingData::GroupCreate { uuid }),
                })
            } else {
                warn!("bad request data for group create");
                // TODO: send error response
                None
            }
        }

        IncomingKind::GroupJoin => {
            if let IncomingData::GroupJoin { uuid } = req.data.as_ref().unwrap()
            {
                let mut writer = state.write().await;
                if let Some(group) = writer.groups.get_mut(uuid) {
                    Some(Outgoing {
                        id: req.id,
                        kind: None,
                        data: Some(OutgoingData::GroupJoin {
                            group: group.clone(),
                        }),
                    })
                } else {
                    warn!("group does not exist: {}", uuid);
                    // TODO: send error response
                    None
                }
            } else {
                warn!("bad request data for group join");
                // TODO: send error response
                None
            }
        }

        IncomingKind::SessionCreate => {
            if let IncomingData::SessionCreate { group_id, phase } =
                req.data.as_ref().unwrap()
            {
                let mut writer = state.write().await;
                if let Some(group) = writer.groups.get_mut(group_id) {
                    let mut session = Session::from(phase.clone());
                    // Caller automatically becomes the first
                    // member of the session
                    session.signup(conn_id);

                    let key = session.uuid.clone();
                    group.sessions.insert(key, session.clone());
                    drop(writer);

                    let notification = Outgoing {
                        id: None,
                        kind: Some(OutgoingKind::SessionCreate),
                        data: Some(OutgoingData::SessionCreate {
                            session: session.clone(),
                        }),
                    };

                    broadcast_message(
                        &notification,
                        state,
                        Some(vec![conn_id]),
                    )
                    .await;

                    Some(Outgoing {
                        id: req.id,
                        kind: Some(OutgoingKind::SessionCreate),
                        data: Some(OutgoingData::SessionCreate { session }),
                    })
                } else {
                    warn!("group does not exist: {}", group_id);
                    // TODO: send error response
                    None
                }
            } else {
                warn!("bad request data for session create");
                // TODO: send error response
                None
            }
        }

        // Signup creates a PartySignup
        IncomingKind::PartySignup => {
            if let IncomingData::PartySignup { .. } = req.data.as_ref().unwrap()
            {
                let info = state.read().await;
                //let mut session: Session = Default::default();
                //let party_signup = session.signup();

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
                let msg = Outgoing {
                    id: None,
                    kind: Some(OutgoingKind::SignProposal),
                    data: Some(OutgoingData::Message {
                        message: message.clone(),
                    }),
                };

                let lock = BROADCAST_LOCK.try_lock();
                if let Ok(_) = lock {
                    broadcast_message(&msg, state, None).await;
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
                        Phase::Keygen => parties,
                        Phase::Sign => threshold + 1,
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
                    if let Phase::Sign = phase {
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

/// Broadcast a message to all clients ignoring any connection ids in filter.
async fn broadcast_message(
    res: &Outgoing,
    state: &Arc<RwLock<State>>,
    filter: Option<Vec<usize>>,
) {
    let info = state.read().await;
    let clients: Vec<usize> = info.clients.keys().cloned().collect();
    drop(info);
    for conn_id in clients {
        if let Some(filter) = &filter {
            if let Some(_) = filter.iter().find(|conn| **conn == conn_id) {
                continue;
            }
        }
        send_message(conn_id, res, state).await;
    }
}

async fn client_disconnected(conn_id: usize, state: &Arc<RwLock<State>>) {
    info!("disconnected (uid={})", conn_id);

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
