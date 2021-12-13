use aes_gcm::{
    aead::{Aead, NewAead},
    Aes256Gcm, Nonce,
};
use common::{Entry, PeerEntry};
use curv::{
    cryptographic_primitives::{
        proofs::sigma_dlog::DLogProof,
        secret_sharing::feldman_vss::VerifiableSS,
    },
    elliptic::curves::{secp256_k1::Secp256k1, Point, Scalar},
};
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2018::party_i::{
    KeyGenBroadcastMessage1, KeyGenDecommitMessage1, Keys, SharedKeys,
};
use paillier::EncryptionKey;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::Sha256;

pub const AES_KEY_BYTES_LEN: usize = 32;

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct AeadPack {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Round1Entry {
    pub party_keys: Keys,
    pub entry: Entry,
    pub decom_i: KeyGenDecommitMessage1,
    pub bc_i: KeyGenBroadcastMessage1,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Round2Entry {
    pub party_keys: Keys,
    pub entry: Entry,
    pub decom_i: KeyGenDecommitMessage1,
    pub bc1_vec: Vec<KeyGenBroadcastMessage1>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Round3Entry {
    pub party_keys: Keys,
    pub enc_keys: Vec<Vec<u8>>,
    pub vss_scheme: VerifiableSS<Secp256k1>,
    pub secret_shares: Vec<Scalar<Secp256k1>>,
    pub y_sum: Point<Secp256k1>,
    pub peer_entries: Vec<PeerEntry>,
    pub point_vec: Vec<Point<Secp256k1>>,
    pub bc1_vec: Vec<KeyGenBroadcastMessage1>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Round4Entry {
    pub party_keys: Keys,
    pub entry: Entry,
    pub party_shares: Vec<Scalar<Secp256k1>>,
    pub vss_scheme: VerifiableSS<Secp256k1>,
    pub point_vec: Vec<Point<Secp256k1>>,
    pub y_sum: Point<Secp256k1>,
    pub bc1_vec: Vec<KeyGenBroadcastMessage1>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Round5Entry {
    pub party_keys: Keys,
    pub shared_keys: SharedKeys,
    pub entry: Entry,
    pub dlog_proof: DLogProof<Secp256k1, Sha256>,
    pub point_vec: Vec<Point<Secp256k1>>,
    pub vss_scheme_vec: Vec<VerifiableSS<Secp256k1>>,
    pub y_sum: Point<Secp256k1>,
    pub bc1_vec: Vec<KeyGenBroadcastMessage1>,
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

#[allow(dead_code)]
pub fn aes_encrypt(key: &[u8], plaintext: &[u8]) -> AeadPack {
    // 96 bit (12 byte) unique nonce per message
    let nonce: Vec<u8> = (1..=12)
        .into_iter()
        .map(|_| rand::thread_rng().gen::<u8>())
        .collect();
    let cipher_nonce = Nonce::from_slice(&nonce);
    let cipher = Aes256Gcm::new(aes_gcm::Key::from_slice(key));
    let ciphertext = cipher.encrypt(cipher_nonce, plaintext).unwrap();
    AeadPack { ciphertext, nonce }
}

#[allow(dead_code)]
pub fn aes_decrypt(key: &[u8], aead_pack: AeadPack) -> Vec<u8> {
    let cipher_nonce = Nonce::from_slice(&aead_pack.nonce);
    let cipher = Aes256Gcm::new(aes_gcm::Key::from_slice(key));
    cipher
        .decrypt(cipher_nonce, aead_pack.ciphertext.as_ref())
        .unwrap()
}
