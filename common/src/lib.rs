/// Common types shared between the server and webassembly modules.
use aes_gcm::aead::{Aead, NewAead};
use aes_gcm::{Aes256Gcm, Nonce};
use rand::Rng;

#[cfg(target_arch = "wasm32")]
use curv::{
    cryptographic_primitives::secret_sharing::feldman_vss::VerifiableSS,
    elliptic::curves::{secp256_k1::Secp256k1, Point, Scalar},
};

#[cfg(target_arch = "wasm32")]
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2018::party_i::{
    KeyGenBroadcastMessage1, KeyGenDecommitMessage1, Keys,
};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use serde::{Deserialize, Serialize};

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[cfg(target_arch = "wasm32")]
#[macro_export]
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

pub const ROUND_1: &str = "round1";
pub const ROUND_2: &str = "round2";
pub const ROUND_3: &str = "round3";
pub const ROUND_4: &str = "round4";
pub const AES_KEY_BYTES_LEN: usize = 32;

pub type Key = String;

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct AEAD {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}

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
    pub key: Key,
    pub value: String,
}

#[cfg(target_arch = "wasm32")]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Round1Entry {
    pub party_keys: Keys,
    pub entry: Entry,
    pub decom_i: KeyGenDecommitMessage1,
    pub bc_i: KeyGenBroadcastMessage1,
}

#[cfg(target_arch = "wasm32")]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Round2Entry {
    pub party_keys: Keys,
    pub entry: Entry,
    pub decom_i: KeyGenDecommitMessage1,
    pub bc1_vec: Vec<KeyGenBroadcastMessage1>,
}

#[cfg(target_arch = "wasm32")]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Round3Entry {
    pub enc_keys: Vec<Vec<u8>>,
    pub vss_scheme: VerifiableSS<Secp256k1>,
    pub secret_shares: Vec<Scalar<Secp256k1>>,
    pub y_sum: Point<Secp256k1>,
    pub peer_entries: Vec<PeerEntry>,
}

#[cfg(target_arch = "wasm32")]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Round4Entry {
    pub entry: Entry,
    pub party_shares: Vec<Scalar<Secp256k1>>,
    pub vss_scheme: VerifiableSS<Secp256k1>,
}

pub fn into_round_entry(
    party_num: u16,
    round: &str,
    value: String,
    sender_uuid: String,
) -> Entry {
    let key = format!("{}-{}-{}", party_num, round, sender_uuid);
    Entry { key, value }
}

pub fn into_p2p_entry(
    party_from: u16,
    party_to: u16,
    round: &str,
    value: String,
    sender_uuid: String,
) -> Entry {
    let key = format!("{}-{}-{}-{}", party_from, party_to, round, sender_uuid);
    Entry { key, value }
}

#[cfg(target_arch = "wasm32")]
#[allow(dead_code)]
pub fn aes_encrypt(key: &[u8], plaintext: &[u8]) -> AEAD {
    // 96 bit (12 byte) unique nonce per message
    let nonce: Vec<u8> = (1..=12)
        .into_iter()
        .map(|_| rand::thread_rng().gen::<u8>())
        .collect();
    let cipher_nonce = Nonce::from_slice(&nonce);
    let cipher = Aes256Gcm::new(aes_gcm::Key::from_slice(key));
    let ciphertext = cipher.encrypt(cipher_nonce, plaintext).unwrap();
    AEAD { ciphertext, nonce }
}

#[cfg(target_arch = "wasm32")]
#[allow(dead_code)]
pub fn aes_decrypt(key: &[u8], aead_pack: AEAD) -> Vec<u8> {
    let cipher_nonce = Nonce::from_slice(&aead_pack.nonce);
    let cipher = Aes256Gcm::new(aes_gcm::Key::from_slice(key));
    cipher
        .decrypt(cipher_nonce, aead_pack.ciphertext.as_ref())
        .unwrap()
}
