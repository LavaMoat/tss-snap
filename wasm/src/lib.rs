use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2018::party_i::Keys;

use common::{into_round_entry, PartySignup, Round1Entry};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
extern crate wasm_bindgen;

#[cfg(all(test, target_arch = "wasm32"))]
extern crate wasm_bindgen_test;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[cfg(target_arch = "wasm32")]
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
    console_log!("WASM: module started.");
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn keygen_signup_entry(keygen_signup: JsValue) -> JsValue {
    let PartySignup { number, uuid } =
        keygen_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);
    println!("number: {:?}, uuid: {:?}", party_num_int, uuid);

    let party_keys = Keys::create(party_num_int);
    let (bc_i, decom_i) =
        party_keys.phase1_broadcast_phase3_proof_of_correct_key();

    // This is the entry that needs to be broadcast to the server
    // by all parties
    let entry = into_round_entry(
        party_num_int,
        "round1",
        serde_json::to_string(&bc_i).unwrap(),
        uuid,
    );

    // Store decom_i so that Javascript can pass it back to WASM
    // for future key generation phases
    let round_entry = Round1Entry { entry, decom_i };

    // Pass back to the Javascript so it can be broadcast to the server
    JsValue::from_serde(&round_entry).unwrap()

    /*
    // send commitment to ephemeral public keys, get round 1 commitments of other parties
    assert!(broadcast(
        &client,
        party_num_int,
        "round1",
        serde_json::to_string(&bc_i).unwrap(),
        uuid.clone()
    )
    .is_ok());
    let round1_ans_vec = poll_for_broadcasts(
        &client,
        party_num_int,
        PARTIES,
        delay,
        "round1",
        uuid.clone(),
    );
    */
}
