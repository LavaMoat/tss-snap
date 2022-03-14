use std::net::SocketAddr;
use std::path::PathBuf;
use std::str::FromStr;
use structopt::StructOpt;

use mpc_websocket::{Result, Server};

#[derive(Debug, StructOpt)]
#[structopt(
    name = "mpc-websocket",
    about = "Websocket server for MPC key generation and signing"
)]
struct Options {
    /// Bind to host:port.
    #[structopt(short, long)]
    bind: Option<String>,
    /// Path to static files to serve
    #[structopt(parse(from_os_str))]
    files: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let opts = Options::from_args();

    let level = std::env::var("RUST_LOG")
        .ok()
        .or_else(|| Some("info".to_string()))
        .unwrap();
    std::env::set_var("RUST_LOG", &level);
    pretty_env_logger::init();

    let bind = opts.bind.unwrap_or_else(|| "127.0.0.1:3030".to_string());
    let addr = SocketAddr::from_str(&bind)?;
    Server::start("demo", (addr.ip(), addr.port()), opts.files).await
}
