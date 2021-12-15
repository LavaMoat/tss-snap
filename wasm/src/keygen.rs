use aes_gcm::{
    aead::{Aead, NewAead},
    Aes256Gcm, Nonce,
};
use rand::Rng;

use common::{
    Entry, PartySignup, PeerEntry, ROUND_1, ROUND_2, ROUND_3, ROUND_4, ROUND_5,
};
use curv::{
    arithmetic::Converter,
    cryptographic_primitives::{
        proofs::sigma_dlog::DLogProof,
        secret_sharing::feldman_vss::VerifiableSS,
    },
    elliptic::curves::{secp256_k1::Secp256k1, Point, Scalar},
    BigInt,
};
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2018::party_i::{
    KeyGenBroadcastMessage1, KeyGenDecommitMessage1, Keys, Parameters,
    SharedKeys,
};
use paillier::EncryptionKey;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use wasm_bindgen::prelude::*;

use super::utils::{into_p2p_entry, into_round_entry, Params, PartyKey};

//use super::{console_log, log};

const AES_KEY_BYTES_LEN: usize = 32;

#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
struct AeadPack {
    ciphertext: Vec<u8>,
    nonce: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round1Entry {
    party_keys: Keys,
    entry: Entry,
    decom_i: KeyGenDecommitMessage1,
    bc_i: KeyGenBroadcastMessage1,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round2Entry {
    party_keys: Keys,
    entry: Entry,
    decom_i: KeyGenDecommitMessage1,
    bc1_vec: Vec<KeyGenBroadcastMessage1>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round3Entry {
    party_keys: Keys,
    enc_keys: Vec<Vec<u8>>,
    vss_scheme: VerifiableSS<Secp256k1>,
    secret_shares: Vec<Scalar<Secp256k1>>,
    y_sum: Point<Secp256k1>,
    peer_entries: Vec<PeerEntry>,
    point_vec: Vec<Point<Secp256k1>>,
    bc1_vec: Vec<KeyGenBroadcastMessage1>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round4Entry {
    party_keys: Keys,
    entry: Entry,
    party_shares: Vec<Scalar<Secp256k1>>,
    vss_scheme: VerifiableSS<Secp256k1>,
    point_vec: Vec<Point<Secp256k1>>,
    y_sum: Point<Secp256k1>,
    bc1_vec: Vec<KeyGenBroadcastMessage1>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round5Entry {
    party_keys: Keys,
    shared_keys: SharedKeys,
    entry: Entry,
    dlog_proof: DLogProof<Secp256k1, Sha256>,
    point_vec: Vec<Point<Secp256k1>>,
    vss_scheme_vec: Vec<VerifiableSS<Secp256k1>>,
    y_sum: Point<Secp256k1>,
    bc1_vec: Vec<KeyGenBroadcastMessage1>,
}

fn aes_encrypt(key: &[u8], plaintext: &[u8]) -> AeadPack {
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

fn aes_decrypt(key: &[u8], aead_pack: AeadPack) -> Vec<u8> {
    let cipher_nonce = Nonce::from_slice(&aead_pack.nonce);
    let cipher = Aes256Gcm::new(aes_gcm::Key::from_slice(key));
    cipher
        .decrypt(cipher_nonce, aead_pack.ciphertext.as_ref())
        .unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn keygenRound1(party_signup: JsValue) -> JsValue {
    //console_log!("WASM: keygen round 1");

    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let party_keys = Keys::create(party_num_int);
    let (bc_i, decom_i) =
        party_keys.phase1_broadcast_phase3_proof_of_correct_key();

    // This is the entry that needs to be sent to the server
    // by all parties
    let entry = into_round_entry(
        party_num_int,
        ROUND_1,
        serde_json::to_string(&bc_i).unwrap(),
        uuid,
    );

    // Store decom_i and bc_i so that Javascript can pass it back to WASM
    // for future key generation phases
    let round_entry = Round1Entry {
        party_keys,
        entry,
        decom_i,
        bc_i,
    };

    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn keygenRound2(
    party_signup: JsValue,
    round1_entry: JsValue,
    round1_ans_vec: JsValue,
) -> JsValue {
    //console_log!("WASM: keygen round 2");

    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let round1_ans_vec: Vec<String> = round1_ans_vec.into_serde().unwrap();

    let round1_entry: Round1Entry = round1_entry.into_serde().unwrap();
    let Round1Entry {
        party_keys,
        decom_i,
        bc_i,
        ..
    } = round1_entry;

    let mut bc1_vec = round1_ans_vec
        .iter()
        .map(|m| serde_json::from_str::<KeyGenBroadcastMessage1>(m).unwrap())
        .collect::<Vec<_>>();

    bc1_vec.insert(party_num_int as usize - 1, bc_i);

    // Generate the entry for round 2
    let entry = into_round_entry(
        party_num_int,
        ROUND_2,
        serde_json::to_string(&decom_i).unwrap(),
        uuid,
    );

    let round_entry = Round2Entry {
        party_keys,
        entry,
        decom_i,
        bc1_vec,
    };
    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn keygenRound3(
    parameters: JsValue,
    party_signup: JsValue,
    round2_entry: JsValue,
    round2_ans_vec: JsValue,
) -> JsValue {
    //console_log!("WASM: keygen round 3");

    let params: Parameters = parameters.into_serde::<Params>().unwrap().into();
    let Parameters {
        share_count: parties,
        ..
    } = params;

    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let round2_ans_vec: Vec<String> = round2_ans_vec.into_serde().unwrap();
    let round2_entry: Round2Entry = round2_entry.into_serde().unwrap();
    let Round2Entry {
        party_keys,
        decom_i,
        bc1_vec,
        ..
    } = round2_entry;

    let mut j = 0;
    let mut point_vec: Vec<Point<Secp256k1>> = Vec::new();
    let mut decom_vec: Vec<KeyGenDecommitMessage1> = Vec::new();
    let mut enc_keys: Vec<Vec<u8>> = Vec::new();
    for i in 1..=parties {
        if i == party_num_int {
            point_vec.push(decom_i.y_i.clone());
            decom_vec.push(decom_i.clone());
        } else {
            let decom_j: KeyGenDecommitMessage1 =
                serde_json::from_str(&round2_ans_vec[j]).unwrap();
            point_vec.push(decom_j.y_i.clone());
            decom_vec.push(decom_j.clone());
            let key_bn: BigInt = (decom_j.y_i.clone() * party_keys.u_i.clone())
                .x_coord()
                .unwrap();
            let key_bytes = BigInt::to_bytes(&key_bn);
            let mut template: Vec<u8> =
                vec![0u8; AES_KEY_BYTES_LEN - key_bytes.len()];
            template.extend_from_slice(&key_bytes[..]);
            enc_keys.push(template);
            j += 1;
        }
    }

    let (head, tail) = point_vec.split_at(1);
    let y_sum = tail.iter().fold(head[0].clone(), |acc, x| acc + x);

    let (vss_scheme, secret_shares, _index) = party_keys
        .phase1_verify_com_phase3_verify_correct_key_phase2_distribute(
            &params, &decom_vec, &bc1_vec,
        )
        .expect("invalid key");

    let mut j = 0;
    let mut peer_entries: Vec<PeerEntry> = Vec::new();
    for (k, i) in (1..=parties).enumerate() {
        if i != party_num_int {
            // prepare encrypted ss for party i:
            let key_i = &enc_keys[j];
            let plaintext = BigInt::to_bytes(&secret_shares[k].to_bigint());
            let aead_pack_i = aes_encrypt(key_i, &plaintext);
            let entry = into_p2p_entry(
                party_num_int,
                i,
                ROUND_3,
                serde_json::to_string(&aead_pack_i).unwrap(),
                uuid.clone(),
            );

            peer_entries.push(PeerEntry {
                party_from: party_num_int,
                party_to: i,
                entry,
            });
            j += 1;
        }
    }

    let round_entry = Round3Entry {
        party_keys,
        enc_keys,
        vss_scheme,
        secret_shares,
        y_sum,
        point_vec,
        peer_entries,
        bc1_vec,
    };

    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn keygenRound4(
    parameters: JsValue,
    party_signup: JsValue,
    round3_entry: JsValue,
    round3_ans_vec: JsValue,
) -> JsValue {
    //console_log!("WASM: keygen round 4");

    let params: Parameters = parameters.into_serde::<Params>().unwrap().into();
    let Parameters {
        share_count: parties,
        ..
    } = params;

    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let round3_ans_vec: Vec<String> = round3_ans_vec.into_serde().unwrap();
    let round3_entry: Round3Entry = round3_entry.into_serde().unwrap();
    let Round3Entry {
        party_keys,
        enc_keys,
        secret_shares,
        vss_scheme,
        point_vec,
        y_sum,
        bc1_vec,
        ..
    } = round3_entry;

    let mut j = 0;
    let mut party_shares: Vec<Scalar<Secp256k1>> = Vec::new();
    for i in 1..=parties {
        if i == party_num_int {
            party_shares.push(secret_shares[(i - 1) as usize].clone());
        } else {
            let aead_pack: AeadPack =
                serde_json::from_str(&round3_ans_vec[j]).unwrap();
            let key_i = &enc_keys[j];
            let out = aes_decrypt(key_i, aead_pack);
            let out_bn = BigInt::from_bytes(&out[..]);
            let out_fe = Scalar::<Secp256k1>::from(&out_bn);
            party_shares.push(out_fe);
            j += 1;
        }
    }

    let entry = into_round_entry(
        party_num_int,
        ROUND_4,
        serde_json::to_string(&vss_scheme).unwrap(),
        uuid,
    );

    let round_entry = Round4Entry {
        party_keys,
        party_shares,
        vss_scheme,
        point_vec,
        entry,
        y_sum,
        bc1_vec,
    };

    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn keygenRound5(
    parameters: JsValue,
    party_signup: JsValue,
    round4_entry: JsValue,
    round4_ans_vec: JsValue,
) -> JsValue {
    //console_log!("WASM: keygen round 5");

    let params: Parameters = parameters.into_serde::<Params>().unwrap().into();
    let Parameters {
        share_count: parties,
        ..
    } = params;

    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let round4_ans_vec: Vec<String> = round4_ans_vec.into_serde().unwrap();
    let round4_entry: Round4Entry = round4_entry.into_serde().unwrap();
    let Round4Entry {
        party_keys,
        party_shares,
        vss_scheme,
        point_vec,
        y_sum,
        bc1_vec,
        ..
    } = round4_entry;

    let mut j = 0;
    let mut vss_scheme_vec: Vec<VerifiableSS<Secp256k1>> = Vec::new();
    for i in 1..=parties {
        if i == party_num_int {
            vss_scheme_vec.push(vss_scheme.clone());
        } else {
            let vss_scheme_j: VerifiableSS<Secp256k1> =
                serde_json::from_str(&round4_ans_vec[j]).unwrap();
            vss_scheme_vec.push(vss_scheme_j);
            j += 1;
        }
    }

    let (shared_keys, dlog_proof) = party_keys
        .phase2_verify_vss_construct_keypair_phase3_pok_dlog(
            &params,
            &point_vec,
            &party_shares,
            &vss_scheme_vec,
            party_num_int,
        )
        .expect("invalid vss");

    let entry = into_round_entry(
        party_num_int,
        ROUND_5,
        serde_json::to_string(&dlog_proof).unwrap(),
        uuid,
    );

    let round_entry = Round5Entry {
        shared_keys,
        entry,
        dlog_proof,
        point_vec,
        party_keys,
        vss_scheme_vec,
        y_sum,
        bc1_vec,
    };

    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn createKey(
    parameters: JsValue,
    party_signup: JsValue,
    round5_entry: JsValue,
    round5_ans_vec: JsValue,
) -> JsValue {
    //console_log!("WASM: keygen create");

    let params: Parameters = parameters.into_serde::<Params>().unwrap().into();
    let Parameters {
        share_count: parties,
        ..
    } = params;

    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, _uuid) = (number, uuid);

    let round5_ans_vec: Vec<String> = round5_ans_vec.into_serde().unwrap();
    let round5_entry: Round5Entry = round5_entry.into_serde().unwrap();
    let Round5Entry {
        party_keys,
        shared_keys,
        dlog_proof,
        point_vec,
        vss_scheme_vec,
        y_sum,
        bc1_vec,
        ..
    } = round5_entry;

    let mut j = 0;
    let mut dlog_proof_vec: Vec<DLogProof<Secp256k1, Sha256>> = Vec::new();
    for i in 1..=parties {
        if i == party_num_int {
            dlog_proof_vec.push(dlog_proof.clone());
        } else {
            let dlog_proof_j: DLogProof<Secp256k1, Sha256> =
                serde_json::from_str(&round5_ans_vec[j]).unwrap();
            dlog_proof_vec.push(dlog_proof_j);
            j += 1;
        }
    }
    Keys::verify_dlog_proofs(&params, &dlog_proof_vec, &point_vec)
        .expect("bad dlog proof");

    //save key to file:
    let paillier_key_vec = (0..parties)
        .map(|i| bc1_vec[i as usize].e.clone())
        .collect::<Vec<EncryptionKey>>();

    let party_key = PartyKey {
        party_keys,
        shared_keys,
        party_id: party_num_int,
        vss_scheme_vec,
        paillier_key_vec,
        y_sum,
    };

    JsValue::from_serde(&party_key).unwrap()
}
