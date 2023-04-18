use serde::{Serialize, Deserialize};
use curv::elliptic::curves::secp256_k1::Secp256k1;
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2020::state_machine::keygen::{
    LocalKey
};
use sha3::{Digest, Keccak256};

/// Parameters used during key generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameters {
    /// Number of parties `n`.
    pub parties: u16,
    /// Threshold for signing `t`.
    ///
    /// The threshold must be crossed (`t + 1`) for signing
    /// to commence.
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

/// Session information for a single party.
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct PartySignup {
    /// Unique index for the party.
    pub number: u16,
    /// Session identifier.
    pub uuid: String,
}

/// Generated key share.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KeyShare {
    /// The secret private key.
    #[serde(rename = "localKey")]
    pub local_key: LocalKey<Secp256k1>,
    /// The public key.
    #[serde(rename = "publicKey")]
    pub public_key: Vec<u8>,
    /// Address generated from the public key.
    pub address: String,
}

impl From<LocalKey<Secp256k1>> for KeyShare {
    fn from(local_key: LocalKey<Secp256k1>) -> Self {
        let public_key = local_key.public_key().to_bytes(false).to_vec();
        Self {
            local_key,
            address: address(&public_key),
            public_key,
        }
    }
}

/// Compute the address of an uncompressed public key (65 bytes).
pub(crate) fn address(public_key: &Vec<u8>) -> String {
    // Remove the leading 0x04
    let bytes = &public_key[1..];
    let digest = Keccak256::digest(bytes);
    let final_bytes = &digest[12..];
    format!("0x{}", hex::encode(&final_bytes))
}
