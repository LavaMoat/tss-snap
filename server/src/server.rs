use anyhow::Result;
use futures_util::{FutureExt, StreamExt};
use std::net::SocketAddr;
use warp::Filter;

pub struct Server;

impl Server {
    pub async fn start(addr: impl Into<SocketAddr>) -> Result<()> {
        let routes = warp::path("echo").and(warp::ws()).map(|ws: warp::ws::Ws| {
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
