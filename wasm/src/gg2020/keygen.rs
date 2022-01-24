use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2020::state_machine::keygen::Keygen;

use wasm_bindgen::prelude::*;

use common::PartySignup;

use crate::utils::Params;

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn keygenRound1(parameters: JsValue, party_signup: JsValue) -> JsValue {
    let params: Params = parameters.into_serde().unwrap();
    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, uuid) = (number, uuid);

    JsValue::from_serde(&()).unwrap()
}

thread_local! {
    static KEYGEN: Option<Keygen> = None;
    //Keygen::new(1, 1, 3).unwrap();
}
