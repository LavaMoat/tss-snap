use common::{Entry, PartySignup, ROUND_0};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use super::utils::{into_round_entry, PartyKey};

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Round0Entry {
    pub entry: Entry,
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn signRound0(party_signup: JsValue, party_key: JsValue) -> JsValue {
    // Round zero broadcasts the party identifiers
    //
    // Note that `party_num_int` and `party_id` are equal but we use
    // `party_id` from the keys to verify the caller has already generated
    // a valid `PartyKey`
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
