//! Websocket server for MPC key generation and signing using JSON-RPC.
//!
//! The library has been designed so that the messages transferred
//! between parties are only stored in memory for the shortest lifetime;
//! that is just enough time to extract the required routing information
//! to be able to handle the message.
//!
//! Auditors will want to pay particular attention to the handling of the `SESSION_MESSAGE` and `NOTIFY_PROPOSAL` methods which are sensitive for security and privacy reasons.
//!
//! By looking at the source for [Group](Group), [Session](Session) and [State](State) structs auditors can verify that no sensitive information is stored in the server state.
//!
#![deny(missing_docs)]
mod server;
pub mod services;

pub use server::*;
