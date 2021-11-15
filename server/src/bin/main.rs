use anyhow::Result;
use structopt::StructOpt;
use ecdsa_wasm_server::{Server, Parameters};


#[derive(Debug, StructOpt)]
#[structopt(name = "ecdsa-wasm-server", about = "Websocket server for the ECDSA WASM demo")]
struct Options {
    /// Number of parties for key generation.
    #[structopt(short, long)]
    parties: u16,
    /// Threshold for signing.
    #[structopt(short, long)]
    threshold: u16,
}

#[tokio::main]
async fn main() -> Result<()> {

    let opts = Options::from_args();
    println!("{:?}", opts);

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

    let addr = ([127, 0, 0, 1], 3030);
    Server::start(addr, params).await
}
