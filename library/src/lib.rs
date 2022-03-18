//! Websocket server for MPC key generation and signing using JSON-RPC.
//!
//! The library has been designed so that the messages transferred
//! between parties are only stored in memory for the shortest lifetime;
//! that is just enough time to extract the required routing information
//! to be able to handle the message.
//!
//! Auditors will want to pay particular attention to the handling of the `SESSION_MESSAGE` method.
//!
#![deny(missing_docs)]
mod server;
pub mod services;

pub use server::*;
