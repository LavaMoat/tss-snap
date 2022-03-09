//! Websocket server for MPC key generation and signing using JSON-RPC.
#![deny(missing_docs)]
mod server;
pub mod services;

pub use server::*;
