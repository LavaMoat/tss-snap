/// Common types shared between the server and webassembly modules.

#[cfg(target_arch = "wasm32")]
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2018::party_i::KeyGenDecommitMessage1;

use serde::{Deserialize, Serialize};

pub const ROUND_1: &str = "round1";

pub type Key = String;

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct PartySignup {
    pub number: u16,
    pub uuid: String,
}

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct Entry {
    pub key: Key,
    pub value: String,
    pub party_num: u16,
}

#[cfg(target_arch = "wasm32")]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Round1Entry {
    pub entry: Entry,
    pub decom_i: KeyGenDecommitMessage1,
}

pub fn into_round_entry(
    party_num: u16,
    round: &str,
    value: String,
    sender_uuid: String,
) -> Entry {
    let key = format!("{}-{}-{}", party_num, round, sender_uuid);
    Entry { key, value, party_num }
}
