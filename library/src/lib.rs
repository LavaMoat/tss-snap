//! # Hazmat
//!
//! DO NOT use this in production without end-to-end encryption as it is
//! vulnerable to a MITM attack if the server is compromised.
//!
//! Instead you can should use a
//! [framework](https://github.com/mpc-sdk/framework) with
//! end-to-end encryption.
//!
//! # About
//!
//! Experimental websocket server for MPC key generation and
//! signing using JSON-RPC.
//!
//! The library has been designed so that the messages transferred
//! between parties are only stored in memory for the shortest lifetime;
//! that is just enough time to extract the required routing information
//! to be able to handle the message.
//!
//! Auditors will want to pay particular attention to the handling
//! of the `SESSION_MESSAGE` and `NOTIFY_PROPOSAL` methods which
//! are sensitive for security and privacy reasons.
//!
//! By looking at the source for [Group](Group), [Session](Session)
//! and [State](State) structs auditors can verify that no sensitive
//! information is stored in the server state.
//!
//! A session may have associated data in it's `value` which is
//! public information that can be shared between clients; the `value`
//! may be set by the session *owner* when the session is created and
//! later retrieved by other clients when they join the session.
//!
//! The associated session data is typically used by signing sessions
//! to indicate the message or transaction that will be signed.
#![deny(missing_docs)]
mod server;
pub mod services;

pub use server::*;
