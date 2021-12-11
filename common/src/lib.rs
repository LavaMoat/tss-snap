/// Common types shared between the server and webassembly modules.
use serde::{Deserialize, Serialize};

pub const ROUND_1: &str = "round1";
pub const ROUND_2: &str = "round2";
pub const ROUND_3: &str = "round3";
pub const ROUND_4: &str = "round4";
pub const ROUND_5: &str = "round5";

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct PeerEntry {
    pub party_from: u16,
    pub party_to: u16,
    pub entry: Entry,
}

/// Parameters for key generation and signing.
#[derive(Debug, Serialize, Deserialize)]
pub struct Parameters {
    pub parties: u16,
    pub threshold: u16,
}

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct PartySignup {
    pub number: u16,
    pub uuid: String,
}

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct Entry {
    pub key: String,
    pub value: String,
}
