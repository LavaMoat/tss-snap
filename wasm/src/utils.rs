use curv::elliptic::curves::secp256_k1::Secp256k1;
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2020::state_machine::keygen::LocalKey;

use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};

/// Compute the address of an uncompressed public key (65 bytes).
pub fn address(public_key: &Vec<u8>) -> String {
    // Remove the leading 0x04
    let bytes = &public_key[1..];
    let digest = Keccak256::digest(bytes);
    let final_bytes = &digest[12..];
    format!("0x{}", hex::encode(&final_bytes))
}

/// The generated key data (gg2020).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KeyShare {
    #[serde(rename = "localKey")]
    pub local_key: LocalKey<Secp256k1>,
    #[serde(rename = "publicKey")]
    pub public_key: Vec<u8>,
    pub address: String,
}
