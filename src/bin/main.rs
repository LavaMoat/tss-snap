use anyhow::Result;
use ecdsa_wasm::server::Server;

#[tokio::main]
async fn main() -> Result<()> {
    let level = std::env::var("RUST_LOG")
        .ok()
        .or_else(|| Some("info".to_string()))
        .unwrap();
    std::env::set_var("RUST_LOG", &level);
    pretty_env_logger::init();

    let addr = ([127, 0, 0, 1], 3030);
    Server::start(addr).await
}
