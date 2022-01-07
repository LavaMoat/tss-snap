/// Common types shared between the server and webassembly modules.
use serde::{Deserialize, Serialize};

pub const ROUND_0: u16 = 0;
pub const ROUND_1: u16 = 1;
pub const ROUND_2: u16 = 2;
pub const ROUND_3: u16 = 3;
pub const ROUND_4: u16 = 4;
pub const ROUND_5: u16 = 5;
pub const ROUND_6: u16 = 6;
pub const ROUND_7: u16 = 7;
pub const ROUND_8: u16 = 8;
pub const ROUND_9: u16 = 9;

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct PeerEntry {
    pub party_from: u16,
    pub party_to: u16,
    pub value: String,
    pub round: u16,

    #[serde(skip)]
    pub session: String,
}

/// Parameters for key generation and signing.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameters {
    pub parties: u16,
    pub threshold: u16,
}

impl Default for Parameters {
    fn default() -> Self {
        return Self {
            parties: 3,
            threshold: 1,
        };
    }
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
