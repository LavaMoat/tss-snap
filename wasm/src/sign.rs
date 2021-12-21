use curv::{
    arithmetic::traits::*,
    cryptographic_primitives::{
        proofs::sigma_correct_homomorphic_elgamal_enc::HomoELGamalProof,
        proofs::sigma_dlog::DLogProof,
    },
    elliptic::curves::{secp256_k1::Secp256k1, Point, Scalar},
    BigInt,
};
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2018::party_i::{
    Keys, LocalSignature, Parameters, PartyPrivate, Phase5ADecom1, Phase5Com1,
    Phase5Com2, Phase5DDecom2, /* SharedKeys, */
    SignBroadcastPhase1, SignDecommitPhase1, SignKeys,
};
use multi_party_ecdsa::utilities::mta::*;
use sha2::Sha256;

use common::{
    Entry, PartySignup, PeerEntry, SignResult, ROUND_0, ROUND_1, ROUND_2,
    ROUND_3, ROUND_4, ROUND_5, ROUND_6, ROUND_7, ROUND_8, ROUND_9,
};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use super::utils::{into_p2p_entry, into_round_entry, Params, PartyKey};

//use super::{console_log, log};

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round0Entry {
    peer_entries: Vec<PeerEntry>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round1Entry {
    peer_entries: Vec<PeerEntry>,
    xi_com_vec: Vec<Point<Secp256k1>>,
    decommit: SignDecommitPhase1,
    signers_vec: Vec<u16>,
    sign_keys: SignKeys,
    com: SignBroadcastPhase1,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round2Entry {
    peer_entries: Vec<PeerEntry>,
    decommit: SignDecommitPhase1,
    xi_com_vec: Vec<Point<Secp256k1>>,
    ni_vec: Vec<Scalar<Secp256k1>>,
    signers_vec: Vec<u16>,
    sign_keys: SignKeys,
    beta_vec: Vec<Scalar<Secp256k1>>,
    bc1_vec: Vec<SignBroadcastPhase1>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round3Entry {
    entry: Entry,
    decommit: SignDecommitPhase1,
    delta_i: Scalar<Secp256k1>,
    sigma: Scalar<Secp256k1>,
    sign_keys: SignKeys,
    bc1_vec: Vec<SignBroadcastPhase1>,
    m_b_gamma_rec_vec: Vec<MessageB>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round4Entry {
    entry: Entry,
    decommit: SignDecommitPhase1,
    delta_inv: Scalar<Secp256k1>,
    sigma: Scalar<Secp256k1>,
    sign_keys: SignKeys,
    bc1_vec: Vec<SignBroadcastPhase1>,
    m_b_gamma_rec_vec: Vec<MessageB>,
}

#[allow(non_snake_case)]
#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round5Entry {
    entry: Entry,
    phase5_com: Phase5Com1,
    phase_5a_decom: Phase5ADecom1,
    helgamal_proof: HomoELGamalProof<Secp256k1, Sha256>,
    dlog_proof_rho: DLogProof<Secp256k1, Sha256>,
    local_sig: LocalSignature,
    R: Point<Secp256k1>,
    message_bn: BigInt,
}

#[allow(non_snake_case)]
#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round6Entry {
    entry: Entry,
    helgamal_proof: HomoELGamalProof<Secp256k1, Sha256>,
    dlog_proof_rho: DLogProof<Secp256k1, Sha256>,
    local_sig: LocalSignature,
    phase_5a_decom: Phase5ADecom1,
    commit5a_vec: Vec<Phase5Com1>,
    R: Point<Secp256k1>,
    message_bn: BigInt,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round7Entry {
    entry: Entry,
    decommit5a_and_elgamal_and_dlog_vec_includes_i: Vec<(
        Phase5ADecom1,
        HomoELGamalProof<Secp256k1, Sha256>,
        DLogProof<Secp256k1, Sha256>,
    )>,
    phase_5d_decom2: Phase5DDecom2,
    phase5_com2: Phase5Com2,
    local_sig: LocalSignature,
    message_bn: BigInt,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round8Entry {
    entry: Entry,
    decommit5a_and_elgamal_and_dlog_vec_includes_i: Vec<(
        Phase5ADecom1,
        HomoELGamalProof<Secp256k1, Sha256>,
        DLogProof<Secp256k1, Sha256>,
    )>,
    phase_5d_decom2: Phase5DDecom2,
    local_sig: LocalSignature,
    commit5c_vec: Vec<Phase5Com2>,
    message_bn: BigInt,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round9Entry {
    entry: Entry,
    local_sig: LocalSignature,
    s_i: Scalar<Secp256k1>,
    message_bn: BigInt,
}

fn format_vec_from_reads<'a, T: serde::Deserialize<'a> + Clone>(
    ans_vec: &'a [String],
    party_num: usize,
    value_i: T,
    new_vec: &'a mut Vec<T>,
) {
    let mut j = 0;
    for i in 1..ans_vec.len() + 2 {
        if i == party_num {
            new_vec.push(value_i.clone());
        } else {
            let value_j: T = serde_json::from_str(&ans_vec[j]).unwrap();
            new_vec.push(value_j);
            j += 1;
        }
    }
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound0(
    parameters: JsValue,
    party_signup: JsValue,
    party_key: JsValue,
) -> JsValue {
    let params: Parameters = parameters.into_serde::<Params>().unwrap().into();
    let Parameters { threshold, .. } = params;

    // Round zero broadcasts the party identifiers
    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let PartyKey { party_id, .. } = party_key.into_serde::<PartyKey>().unwrap();

    let mut peer_entries: Vec<PeerEntry> = Vec::new();
    for i in 1..=threshold + 1 {
        if i != party_num_int {
            let entry = into_p2p_entry(
                party_num_int,
                i,
                ROUND_0,
                serde_json::to_string(&party_id).unwrap(),
                uuid.clone(),
            );

            peer_entries.push(PeerEntry {
                party_from: party_num_int,
                party_to: i,
                entry,
            });
        }
    }

    let round_entry = Round0Entry { peer_entries };
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

    /*
    let entry = into_round_entry(
        party_num_int,
        ROUND_1,
        serde_json::to_string(&(com.clone(), m_a_k)).unwrap(),
        uuid,
    );
    */

    let mut peer_entries: Vec<PeerEntry> = Vec::new();
    for i in 1..=threshold + 1 {
        if i != party_num_int {
            let entry = into_p2p_entry(
                party_num_int,
                i,
                ROUND_1,
                serde_json::to_string(&(com.clone(), m_a_k.clone())).unwrap(),
                uuid.clone(),
            );

            peer_entries.push(PeerEntry {
                party_from: party_num_int,
                party_to: i,
                entry,
            });
        }
    }

    let round_entry = Round1Entry {
        peer_entries,
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
        xi_com_vec,
        decommit,
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

    let round_entry = Round2Entry {
        peer_entries,
        ni_vec,
        sign_keys,
        signers_vec,
        beta_vec,
        xi_com_vec,
        decommit,
        bc1_vec,
    };

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
    let params: Parameters = parameters.into_serde::<Params>().unwrap().into();
    let Parameters { threshold, .. } = params;

    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let PartyKey {
        party_keys,
        vss_scheme_vec,
        ..
    } = party_key.into_serde::<PartyKey>().unwrap();

    let round2_ans_vec: Vec<String> = round2_ans_vec.into_serde().unwrap();
    let round2_entry: Round2Entry = round2_entry.into_serde().unwrap();
    let Round2Entry {
        ni_vec,
        sign_keys,
        signers_vec,
        beta_vec,
        xi_com_vec,
        decommit,
        bc1_vec,
        ..
    } = round2_entry;

    let mut m_b_gamma_rec_vec: Vec<MessageB> = Vec::new();
    let mut m_b_w_rec_vec: Vec<MessageB> = Vec::new();

    for i in 0..threshold {
        //  if signers_vec.contains(&(i as usize)) {
        let (m_b_gamma_i, m_b_w_i): (MessageB, MessageB) =
            serde_json::from_str(&round2_ans_vec[i as usize]).unwrap();
        m_b_gamma_rec_vec.push(m_b_gamma_i);
        m_b_w_rec_vec.push(m_b_w_i);
        //     }
    }

    let mut alpha_vec: Vec<Scalar<Secp256k1>> = Vec::new();
    let mut miu_vec: Vec<Scalar<Secp256k1>> = Vec::new();

    let mut j = 0;
    for i in 1..threshold + 2 {
        if i != party_num_int {
            let m_b = m_b_gamma_rec_vec[j].clone();

            let alpha_ij_gamma = m_b
                .verify_proofs_get_alpha(&party_keys.dk, &sign_keys.k_i)
                .expect("wrong dlog or m_b");
            let m_b = m_b_w_rec_vec[j].clone();
            let alpha_ij_wi = m_b
                .verify_proofs_get_alpha(&party_keys.dk, &sign_keys.k_i)
                .expect("wrong dlog or m_b");
            alpha_vec.push(alpha_ij_gamma.0);
            miu_vec.push(alpha_ij_wi.0);
            let g_w_i = Keys::update_commitments_to_xi(
                &xi_com_vec[usize::from(signers_vec[usize::from(i - 1)])],
                &vss_scheme_vec[usize::from(signers_vec[usize::from(i - 1)])],
                signers_vec[usize::from(i - 1)],
                &signers_vec,
            );
            assert_eq!(m_b.b_proof.pk, g_w_i);
            j += 1;
        }
    }
    //////////////////////////////////////////////////////////////////////////////
    let delta_i = sign_keys.phase2_delta_i(&alpha_vec, &beta_vec);
    let sigma = sign_keys.phase2_sigma_i(&miu_vec, &ni_vec);

    let entry = into_round_entry(
        party_num_int,
        ROUND_3,
        serde_json::to_string(&delta_i).unwrap(),
        uuid,
    );

    let round_entry = Round3Entry {
        entry,
        sigma,
        delta_i,
        decommit,
        sign_keys,
        bc1_vec,
        m_b_gamma_rec_vec,
    };
    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound4(
    party_signup: JsValue,
    round3_entry: JsValue,
    round3_ans_vec: JsValue,
) -> JsValue {
    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let round3_ans_vec: Vec<String> = round3_ans_vec.into_serde().unwrap();
    let round3_entry: Round3Entry = round3_entry.into_serde().unwrap();
    let Round3Entry {
        delta_i,
        decommit,
        sigma,
        sign_keys,
        bc1_vec,
        m_b_gamma_rec_vec,
        ..
    } = round3_entry;

    let mut delta_vec: Vec<Scalar<Secp256k1>> = Vec::new();
    format_vec_from_reads(
        &round3_ans_vec,
        party_num_int as usize,
        delta_i,
        &mut delta_vec,
    );
    let delta_inv = SignKeys::phase3_reconstruct_delta(&delta_vec);

    // decommit to gamma_i
    let entry = into_round_entry(
        party_num_int,
        ROUND_4,
        serde_json::to_string(&decommit).unwrap(),
        uuid,
    );

    let round_entry = Round4Entry {
        entry,
        delta_inv,
        decommit,
        sigma,
        sign_keys,
        bc1_vec,
        m_b_gamma_rec_vec,
    };
    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound5(
    party_signup: JsValue,
    party_key: JsValue,
    round4_entry: JsValue,
    round4_ans_vec: JsValue,
    message: JsValue,
) -> JsValue {
    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let PartyKey { y_sum, .. } = party_key.into_serde::<PartyKey>().unwrap();

    let round4_ans_vec: Vec<String> = round4_ans_vec.into_serde().unwrap();
    let round4_entry: Round4Entry = round4_entry.into_serde().unwrap();
    let Round4Entry {
        decommit,
        sigma,
        sign_keys,
        delta_inv,
        mut bc1_vec,
        m_b_gamma_rec_vec,
        ..
    } = round4_entry;

    let message_str: String = message.into_serde().unwrap();
    let message = match hex::decode(message_str.clone()) {
        Ok(x) => x,
        Err(e) => panic!(
            "message must be hex encoded, got error decoding hex ({})",
            e
        ),
    };

    let mut decommit_vec: Vec<SignDecommitPhase1> = Vec::new();
    format_vec_from_reads(
        &round4_ans_vec,
        party_num_int as usize,
        decommit,
        &mut decommit_vec,
    );
    let decomm_i = decommit_vec.remove(usize::from(party_num_int - 1));
    bc1_vec.remove(usize::from(party_num_int - 1));
    let b_proof_vec = (0..m_b_gamma_rec_vec.len())
        .map(|i| &m_b_gamma_rec_vec[i].b_proof)
        .collect::<Vec<&DLogProof<Secp256k1, Sha256>>>();
    let R = SignKeys::phase4(&delta_inv, &b_proof_vec, decommit_vec, &bc1_vec)
        .expect("bad gamma_i decommit");

    // adding local g_gamma_i
    let R = R + decomm_i.g_gamma_i * delta_inv;

    // we assume the message is already hashed (by the signer).
    let message_bn = BigInt::from_bytes(&message);
    let local_sig = LocalSignature::phase5_local_sig(
        &sign_keys.k_i,
        &message_bn,
        &R,
        &sigma,
        &y_sum,
    );

    let (phase5_com, phase_5a_decom, helgamal_proof, dlog_proof_rho) =
        local_sig.phase5a_broadcast_5b_zkproof();

    //phase (5A)  broadcast commit
    let entry = into_round_entry(
        party_num_int,
        ROUND_5,
        serde_json::to_string(&phase5_com).unwrap(),
        uuid,
    );

    let round_entry = Round5Entry {
        entry,
        phase5_com,
        phase_5a_decom,
        helgamal_proof,
        dlog_proof_rho,
        local_sig,
        R,
        message_bn,
    };
    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound6(
    party_signup: JsValue,
    round5_entry: JsValue,
    round5_ans_vec: JsValue,
) -> JsValue {
    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let round5_ans_vec: Vec<String> = round5_ans_vec.into_serde().unwrap();
    let round5_entry: Round5Entry = round5_entry.into_serde().unwrap();
    let Round5Entry {
        phase5_com,
        phase_5a_decom,
        helgamal_proof,
        dlog_proof_rho,
        local_sig,
        R,
        message_bn,
        ..
    } = round5_entry;

    let mut commit5a_vec: Vec<Phase5Com1> = Vec::new();
    format_vec_from_reads(
        &round5_ans_vec,
        party_num_int as usize,
        phase5_com,
        &mut commit5a_vec,
    );

    //phase (5B)  broadcast decommit and (5B) ZK proof
    let entry = into_round_entry(
        party_num_int,
        ROUND_6,
        serde_json::to_string(&(
            phase_5a_decom.clone(),
            helgamal_proof.clone(),
            dlog_proof_rho.clone(),
        ))
        .unwrap(),
        uuid,
    );

    let round_entry = Round6Entry {
        entry,
        helgamal_proof,
        dlog_proof_rho,
        local_sig,
        phase_5a_decom,
        commit5a_vec,
        R,
        message_bn,
    };
    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound7(
    parameters: JsValue,
    party_signup: JsValue,
    round6_entry: JsValue,
    round6_ans_vec: JsValue,
) -> JsValue {
    let params: Parameters = parameters.into_serde::<Params>().unwrap().into();
    let Parameters { threshold, .. } = params;

    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let round6_ans_vec: Vec<String> = round6_ans_vec.into_serde().unwrap();
    let round6_entry: Round6Entry = round6_entry.into_serde().unwrap();
    let Round6Entry {
        mut commit5a_vec,
        phase_5a_decom,
        helgamal_proof,
        dlog_proof_rho,
        local_sig,
        R,
        message_bn,
        ..
    } = round6_entry;

    let mut decommit5a_and_elgamal_and_dlog_vec: Vec<(
        Phase5ADecom1,
        HomoELGamalProof<Secp256k1, Sha256>,
        DLogProof<Secp256k1, Sha256>,
    )> = Vec::new();
    format_vec_from_reads(
        &round6_ans_vec,
        party_num_int as usize,
        (phase_5a_decom.clone(), helgamal_proof, dlog_proof_rho),
        &mut decommit5a_and_elgamal_and_dlog_vec,
    );
    let decommit5a_and_elgamal_and_dlog_vec_includes_i =
        decommit5a_and_elgamal_and_dlog_vec.clone();
    decommit5a_and_elgamal_and_dlog_vec.remove(usize::from(party_num_int - 1));
    commit5a_vec.remove(usize::from(party_num_int - 1));
    let phase_5a_decomm_vec = (0..threshold)
        .map(|i| decommit5a_and_elgamal_and_dlog_vec[i as usize].0.clone())
        .collect::<Vec<Phase5ADecom1>>();
    let phase_5a_elgamal_vec = (0..threshold)
        .map(|i| decommit5a_and_elgamal_and_dlog_vec[i as usize].1.clone())
        .collect::<Vec<HomoELGamalProof<Secp256k1, Sha256>>>();
    let phase_5a_dlog_vec = (0..threshold)
        .map(|i| decommit5a_and_elgamal_and_dlog_vec[i as usize].2.clone())
        .collect::<Vec<DLogProof<Secp256k1, Sha256>>>();
    let (phase5_com2, phase_5d_decom2) = local_sig
        .phase5c(
            &phase_5a_decomm_vec,
            &commit5a_vec,
            &phase_5a_elgamal_vec,
            &phase_5a_dlog_vec,
            &phase_5a_decom.V_i,
            &R,
        )
        .expect("error phase5");

    let entry = into_round_entry(
        party_num_int,
        ROUND_7,
        serde_json::to_string(&phase5_com2).unwrap(),
        uuid,
    );

    let round_entry = Round7Entry {
        entry,
        decommit5a_and_elgamal_and_dlog_vec_includes_i,
        phase_5d_decom2,
        phase5_com2,
        local_sig,
        message_bn,
    };
    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound8(
    party_signup: JsValue,
    round7_entry: JsValue,
    round7_ans_vec: JsValue,
) -> JsValue {
    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let round7_ans_vec: Vec<String> = round7_ans_vec.into_serde().unwrap();
    let round7_entry: Round7Entry = round7_entry.into_serde().unwrap();
    let Round7Entry {
        phase5_com2,
        phase_5d_decom2,
        local_sig,
        decommit5a_and_elgamal_and_dlog_vec_includes_i,
        message_bn,
        ..
    } = round7_entry;

    let mut commit5c_vec: Vec<Phase5Com2> = Vec::new();
    format_vec_from_reads(
        &round7_ans_vec,
        party_num_int as usize,
        phase5_com2,
        &mut commit5c_vec,
    );

    //phase (5B)  broadcast decommit and (5B) ZK proof
    let entry = into_round_entry(
        party_num_int,
        ROUND_8,
        serde_json::to_string(&phase_5d_decom2).unwrap(),
        uuid,
    );

    let round_entry = Round8Entry {
        entry,
        local_sig,
        decommit5a_and_elgamal_and_dlog_vec_includes_i,
        phase_5d_decom2,
        commit5c_vec,
        message_bn,
    };
    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound9(
    parameters: JsValue,
    party_signup: JsValue,
    round8_entry: JsValue,
    round8_ans_vec: JsValue,
) -> JsValue {
    let params: Parameters = parameters.into_serde::<Params>().unwrap().into();
    let Parameters { threshold, .. } = params;

    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    let round8_ans_vec: Vec<String> = round8_ans_vec.into_serde().unwrap();
    let round8_entry: Round8Entry = round8_entry.into_serde().unwrap();
    let Round8Entry {
        local_sig,
        decommit5a_and_elgamal_and_dlog_vec_includes_i,
        phase_5d_decom2,
        commit5c_vec,
        message_bn,
        ..
    } = round8_entry;

    let mut decommit5d_vec: Vec<Phase5DDecom2> = Vec::new();
    format_vec_from_reads(
        &round8_ans_vec,
        party_num_int as usize,
        phase_5d_decom2,
        &mut decommit5d_vec,
    );

    let phase_5a_decomm_vec_includes_i = (0..=threshold)
        .map(|i| {
            decommit5a_and_elgamal_and_dlog_vec_includes_i[i as usize]
                .0
                .clone()
        })
        .collect::<Vec<Phase5ADecom1>>();
    let s_i = local_sig
        .phase5d(
            &decommit5d_vec,
            &commit5c_vec,
            &phase_5a_decomm_vec_includes_i,
        )
        .expect("bad com 5d");

    let entry = into_round_entry(
        party_num_int,
        ROUND_9,
        serde_json::to_string(&s_i).unwrap(),
        uuid,
    );

    let round_entry = Round9Entry {
        entry,
        local_sig,
        s_i,
        message_bn,
    };
    JsValue::from_serde(&round_entry).unwrap()
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signMessage(
    party_signup: JsValue,
    party_key: JsValue,
    round9_entry: JsValue,
    round9_ans_vec: JsValue,
) -> JsValue {
    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, _uuid) = (number, uuid);

    let PartyKey { y_sum, .. } = party_key.into_serde::<PartyKey>().unwrap();

    let round9_ans_vec: Vec<String> = round9_ans_vec.into_serde().unwrap();
    let round9_entry: Round9Entry = round9_entry.into_serde().unwrap();
    let Round9Entry {
        local_sig,
        s_i,
        message_bn,
        ..
    } = round9_entry;

    let mut s_i_vec: Vec<Scalar<Secp256k1>> = Vec::new();
    format_vec_from_reads(
        &round9_ans_vec,
        party_num_int as usize,
        s_i,
        &mut s_i_vec,
    );

    s_i_vec.remove(usize::from(party_num_int - 1));
    let sig = local_sig
        .output_signature(&s_i_vec)
        .expect("verification failed");

    /*
    console_log!("party {:?} Output Signature: \n", party_num_int);
    console_log!("R: {:?}", sig.r);
    console_log!("s: {:?} \n", sig.s);
    console_log!("recid: {:?} \n", sig.recid.clone());
    */

    let sign_result = SignResult {
        r: BigInt::from_bytes(sig.r.to_bytes().as_ref()).to_str_radix(16),
        s: BigInt::from_bytes(sig.s.to_bytes().as_ref()).to_str_radix(16),
        recid: sig.recid,
    };

    // check sig against secp256k1
    check_sig(&sig.r, &sig.s, &message_bn, &y_sum);

    JsValue::from_serde(&sign_result).unwrap()
}

fn check_sig(
    r: &Scalar<Secp256k1>,
    s: &Scalar<Secp256k1>,
    msg: &BigInt,
    pk: &Point<Secp256k1>,
) {
    use secp256k1::{verify, Message, PublicKey, PublicKeyFormat, Signature};

    let raw_msg = BigInt::to_bytes(msg);
    let mut msg: Vec<u8> = Vec::new(); // padding
    msg.extend(vec![0u8; 32 - raw_msg.len()]);
    msg.extend(raw_msg.iter());

    let msg = Message::parse_slice(msg.as_slice()).unwrap();
    let mut raw_pk = pk.to_bytes(false).to_vec();
    if raw_pk.len() == 64 {
        raw_pk.insert(0, 4u8);
    }
    let pk =
        PublicKey::parse_slice(&raw_pk, Some(PublicKeyFormat::Full)).unwrap();

    let mut compact: Vec<u8> = Vec::new();
    let bytes_r = &r.to_bytes().to_vec();
    compact.extend(vec![0u8; 32 - bytes_r.len()]);
    compact.extend(bytes_r.iter());

    let bytes_s = &s.to_bytes().to_vec();
    compact.extend(vec![0u8; 32 - bytes_s.len()]);
    compact.extend(bytes_s.iter());

    let secp_sig = Signature::parse_slice(compact.as_slice()).unwrap();

    let is_correct = verify(&msg, &secp_sig, &pk);
    assert!(is_correct);
}
