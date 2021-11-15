use anyhow::Result;
use ecdsa_wasm::{Parameters, Server};
use std::net::SocketAddr;
use std::str::FromStr;
use structopt::StructOpt;

#[derive(Debug, StructOpt)]
#[structopt(
    name = "ecdsa-wasm",
    about = "Websocket server for the ECDSA WASM demo"
)]
struct Options {
    /// Number of parties for key generation.
    #[structopt(short, long)]
    parties: u16,
    /// Threshold for signing.
    #[structopt(short, long)]
    threshold: u16,
    /// Bind to host:port.
    #[structopt(short, long, default_value = "127.0.0.1:3030")]
    bind: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    let opts = Options::from_args();
    let params = Parameters {
        parties: opts.parties,
        threshold: opts.threshold,
    };

    let level = std::env::var("RUST_LOG")
        .ok()
        .or_else(|| Some("info".to_string()))
        .unwrap();
    std::env::set_var("RUST_LOG", &level);
    pretty_env_logger::init();

    let addr = SocketAddr::from_str(&opts.bind)?;
    Server::start((addr.ip(), addr.port()), params).await
}
