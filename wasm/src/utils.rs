use common::Entry;
use curv::{
    cryptographic_primitives::secret_sharing::feldman_vss::VerifiableSS,
    elliptic::curves::{secp256_k1::Secp256k1, Point},
};
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2018::party_i::{
    Keys, SharedKeys,
};
use paillier::EncryptionKey;
use serde::{Deserialize, Serialize};

/// The generated key data.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PartyKey {
    pub party_keys: Keys,
    pub shared_keys: SharedKeys,
    pub party_id: u16,
    pub vss_scheme_vec: Vec<VerifiableSS<Secp256k1>>,
    pub paillier_key_vec: Vec<EncryptionKey>,
    pub y_sum: Point<Secp256k1>,
}

pub(crate) fn into_round_entry(
    party_num: u16,
    round: &str,
    value: String,
    sender_uuid: String,
) -> Entry {
    let key = format!("{}-{}-{}", party_num, round, sender_uuid);
    Entry { key, value }
}

pub(crate) fn into_p2p_entry(
    party_from: u16,
    party_to: u16,
    round: &str,
    value: String,
    sender_uuid: String,
) -> Entry {
    let key = format!("{}-{}-{}-{}", party_from, party_to, round, sender_uuid);
    Entry { key, value }
}
