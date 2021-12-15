use curv::elliptic::curves::{secp256_k1::Secp256k1, Point /* Scalar */};
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2018::party_i::{
    Keys, Parameters,
    /* LocalSignature, */
    PartyPrivate, /*Phase5ADecom1, Phase5Com1, Phase5Com2,
                  Phase5DDecom2, SharedKeys, SignBroadcastPhase1, */
    SignDecommitPhase1, SignKeys,
};
use multi_party_ecdsa::utilities::mta::*;
//use sha2::Sha256;

//use paillier::EncryptionKey;

use common::{Entry, PartySignup, ROUND_0, ROUND_1};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use super::utils::{into_round_entry, Params, PartyKey};

use super::{console_log, log};

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round0Entry {
    pub entry: Entry,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round1Entry {
    pub entry: Entry,
    pub xi_com_vec: Vec<Point<Secp256k1>>,
    pub decommit: SignDecommitPhase1,
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

    console_log!("GOT PARTY ID {}", party_id);
    console_log!("GOT PARTY NUM INT {}", party_num_int);
    console_log!("GOT VSS SCHEME VEC LENGTH {}", vss_scheme_vec.len());
    console_log!("GOT ROUND 0 ANSWER VEC {:#?}", round0_ans_vec);

    let mut j = 0;
    let mut signers_vec: Vec<u16> = Vec::new();
    for i in 1..=threshold + 1 {
        console_log!("WASM: iterating {:#?}", i);
        if i == party_num_int {
            signers_vec.push(party_id - 1);
        } else {
            let signer_j: u16 =
                serde_json::from_str(&round0_ans_vec[j]).unwrap();
            signers_vec.push(signer_j - 1);
            j += 1;
        }
    }

    println!("GOT ROUND 0 SIGNERS VEC {:#?}", signers_vec);

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
        serde_json::to_string(&(com, m_a_k)).unwrap(),
        uuid,
    );

    let round_entry = Round1Entry {
        entry,
        xi_com_vec,
        decommit,
    };
    JsValue::from_serde(&round_entry).unwrap()
}
