use curv::{
    cryptographic_primitives::secret_sharing::feldman_vss::VerifiableSS,
    elliptic::curves::{secp256_k1::Secp256k1, Point},
};
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2018::party_i::{
    Keys, Parameters, SharedKeys,
};
use paillier::EncryptionKey;
use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Params {
    pub parties: u16,
    pub threshold: u16,
}

impl From<Params> for Parameters {
    fn from(params: Params) -> Self {
        Self {
            share_count: params.parties,
            threshold: params.threshold,
        }
    }
}

/// Compute the address of an uncompressed public key.
pub fn address(public_key: &Vec<u8>) -> String {
    // Remove the leading 0x04
    let bytes = &public_key[1..];
    let digest = Keccak256::digest(bytes);
    let final_bytes = &digest[12..];
    format!("0x{}", hex::encode(&final_bytes))
}

/// The generated key data.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PartyKey {
    pub party_keys: Keys,
    pub shared_keys: SharedKeys,
    pub party_id: u16,
    pub vss_scheme_vec: Vec<VerifiableSS<Secp256k1>>,
    pub paillier_key_vec: Vec<EncryptionKey>,
    pub y_sum: Point<Secp256k1>,
    #[serde(rename = "publicKey")]
    pub public_key: Vec<u8>,
    pub address: String,
}
