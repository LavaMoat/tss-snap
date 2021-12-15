use curv::elliptic::curves::{secp256_k1::Secp256k1, Point, Scalar};
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2018::party_i::{
    Keys, Parameters,
    /* LocalSignature, */
    PartyPrivate, /*Phase5ADecom1, Phase5Com1, Phase5Com2,
                  Phase5DDecom2, SharedKeys, */
    SignBroadcastPhase1, SignDecommitPhase1, SignKeys,
};
use multi_party_ecdsa::utilities::mta::*;
//use sha2::Sha256;

//use paillier::EncryptionKey;

use common::{Entry, PartySignup, PeerEntry, ROUND_0, ROUND_1, ROUND_2};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use super::utils::{into_p2p_entry, into_round_entry, Params, PartyKey};

//use super::{console_log, log};

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round0Entry {
    pub entry: Entry,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round1Entry {
    pub entry: Entry,
    pub xi_com_vec: Vec<Point<Secp256k1>>,
    pub decommit: SignDecommitPhase1,
    pub signers_vec: Vec<u16>,
    pub sign_keys: SignKeys,
    pub com: SignBroadcastPhase1,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round2Entry {
    pub peer_entries: Vec<PeerEntry>,
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound0(party_signup: JsValue, party_key: JsValue) -> JsValue {
    // Round zero broadcasts the party identifiers
    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let PartyKey { party_id, .. } = party_key.into_serde::<PartyKey>().unwrap();

    let entry = into_round_entry(
        party_num_int,
        ROUND_0,
        serde_json::to_string(&party_id).unwrap(),
        uuid,
    );

    let round_entry = Round0Entry { entry };
    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound1(
    parameters: JsValue,
    party_signup: JsValue,
    party_key: JsValue,
    round0_ans_vec: JsValue,
) -> JsValue {
    let params: Parameters = parameters.into_serde::<Params>().unwrap().into();
    let Parameters { threshold, .. } = params;

    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let PartyKey {
        party_keys,
        party_id,
        vss_scheme_vec,
        shared_keys,
        ..
    } = party_key.into_serde::<PartyKey>().unwrap();

    let round0_ans_vec: Vec<String> = round0_ans_vec.into_serde().unwrap();

    let mut j = 0;
    let mut signers_vec: Vec<u16> = Vec::new();
    for i in 1..=threshold + 1 {
        if i == party_num_int {
            signers_vec.push(party_id - 1);
        } else {
            let signer_j: u16 =
                serde_json::from_str(&round0_ans_vec[j]).unwrap();
            signers_vec.push(signer_j - 1);
            j += 1;
        }
    }

    let private = PartyPrivate::set_private(party_keys.clone(), shared_keys);

    let sign_keys = SignKeys::create(
        &private,
        &vss_scheme_vec[signers_vec[(party_num_int - 1) as usize] as usize],
        signers_vec[(party_num_int - 1) as usize],
        &signers_vec,
    );

    let xi_com_vec = Keys::get_commitments_to_xi(&vss_scheme_vec);

    //////////////////////////////////////////////////////////////////////////////
    let (com, decommit) = sign_keys.phase1_broadcast();
    let (m_a_k, _) = MessageA::a(&sign_keys.k_i, &party_keys.ek, &[]);

    let entry = into_round_entry(
        party_num_int,
        ROUND_1,
        serde_json::to_string(&(com.clone(), m_a_k)).unwrap(),
        uuid,
    );

    let round_entry = Round1Entry {
        entry,
        xi_com_vec,
        decommit,
        signers_vec,
        sign_keys,
        com,
    };
    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound2(
    parameters: JsValue,
    party_signup: JsValue,
    party_key: JsValue,
    round1_entry: JsValue,
    round1_ans_vec: JsValue,
) -> JsValue {
    let params: Parameters = parameters.into_serde::<Params>().unwrap().into();
    let Parameters { threshold, .. } = params;

    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let PartyKey {
        paillier_key_vec: paillier_key_vector,
        ..
    } = party_key.into_serde::<PartyKey>().unwrap();

    let round1_ans_vec: Vec<String> = round1_ans_vec.into_serde().unwrap();
    let round1_entry: Round1Entry = round1_entry.into_serde().unwrap();
    let Round1Entry {
        signers_vec,
        sign_keys,
        com,
        ..
    } = round1_entry;

    let mut j = 0;
    let mut bc1_vec: Vec<SignBroadcastPhase1> = Vec::new();
    let mut m_a_vec: Vec<MessageA> = Vec::new();

    for i in 1..threshold + 2 {
        if i == party_num_int {
            bc1_vec.push(com.clone());
        //   m_a_vec.push(m_a_k.clone());
        } else {
            //     if signers_vec.contains(&(i as usize)) {
            let (bc1_j, m_a_party_j): (SignBroadcastPhase1, MessageA) =
                serde_json::from_str(&round1_ans_vec[j]).unwrap();
            bc1_vec.push(bc1_j);
            m_a_vec.push(m_a_party_j);

            j += 1;
            //       }
        }
    }
    assert_eq!(signers_vec.len(), bc1_vec.len());

    //////////////////////////////////////////////////////////////////////////////
    let mut m_b_gamma_send_vec: Vec<MessageB> = Vec::new();
    let mut beta_vec: Vec<Scalar<Secp256k1>> = Vec::new();
    let mut m_b_w_send_vec: Vec<MessageB> = Vec::new();
    let mut ni_vec: Vec<Scalar<Secp256k1>> = Vec::new();
    let mut j = 0;
    for i in 1..threshold + 2 {
        if i != party_num_int {
            let (m_b_gamma, beta_gamma, _, _) = MessageB::b(
                &sign_keys.gamma_i,
                &paillier_key_vector
                    [usize::from(signers_vec[usize::from(i - 1)])],
                m_a_vec[j].clone(),
                &[],
            )
            .unwrap();
            let (m_b_w, beta_wi, _, _) = MessageB::b(
                &sign_keys.w_i,
                &paillier_key_vector
                    [usize::from(signers_vec[usize::from(i - 1)])],
                m_a_vec[j].clone(),
                &[],
            )
            .unwrap();
            m_b_gamma_send_vec.push(m_b_gamma);
            m_b_w_send_vec.push(m_b_w);
            beta_vec.push(beta_gamma);
            ni_vec.push(beta_wi);
            j += 1;
        }
    }

    let mut j = 0;
    let mut peer_entries: Vec<PeerEntry> = Vec::new();
    for i in 1..threshold + 2 {
        if i != party_num_int {
            let entry = into_p2p_entry(
                party_num_int,
                i,
                ROUND_2,
                serde_json::to_string(&(
                    m_b_gamma_send_vec[j].clone(),
                    m_b_w_send_vec[j].clone(),
                ))
                .unwrap(),
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

    let round_entry = Round2Entry { peer_entries };

    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound3(
    parameters: JsValue,
    party_signup: JsValue,
    party_key: JsValue,
    round2_entry: JsValue,
    round2_ans_vec: JsValue,
) -> JsValue {
    JsValue::undefined()
}
