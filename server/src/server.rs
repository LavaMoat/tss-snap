use anyhow::Result;
use futures_util::{FutureExt, StreamExt};
use std::net::SocketAddr;
use std::sync::{Arc, RwLock};
use warp::Filter;

use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Parameters {
    pub parties: u16,
    pub threshold: u16,
}

#[derive(Debug)]
struct State {
    params: Parameters,
}

pub struct Server;

impl Server {
    pub async fn start(addr: impl Into<SocketAddr>, params: Parameters) -> Result<()> {

        let state = Arc::new(RwLock::new(State {params}));
        let state = warp::any().map(move || state.clone());

        let routes = warp::path("echo")
            .and(warp::ws())
            .and(state)
            .map(|ws: warp::ws::Ws, state| {
                ws.on_upgrade(|websocket| {
                    let (tx, rx) = websocket.split();
                    rx.forward(tx).map(|result| {
                        if let Err(e) = result {
                            eprintln!("websocket error: {:?}", e);
                        }
                    })
                })
            });
        warp::serve(routes).run(addr).await;
        Ok(())
    }
}
