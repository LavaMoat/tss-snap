/// Common types shared between the server and webassembly modules.
use serde::{Deserialize, Serialize};

pub const ROUND_0: &str = "round0";
pub const ROUND_1: &str = "round1";
pub const ROUND_2: &str = "round2";
pub const ROUND_3: &str = "round3";
pub const ROUND_4: &str = "round4";
pub const ROUND_5: &str = "round5";
pub const ROUND_6: &str = "round6";
pub const ROUND_7: &str = "round7";
pub const ROUND_8: &str = "round8";
pub const ROUND_9: &str = "round9";

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct PeerEntry {
    pub party_from: u16,
    pub party_to: u16,
    pub value: String,

    #[serde(skip)]
    pub session: String,

    #[serde(skip)]
    pub round: &'static str,
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

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SignResult {
    pub r: String,
    pub s: String,
    pub recid: u8,
}
