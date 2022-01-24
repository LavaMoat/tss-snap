use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2020::state_machine::keygen::Keygen;

use wasm_bindgen::prelude::*;

use common::PartySignup;

use crate::utils::Params;
use round_based::{Msg, StateMachine};

use std::cell::RefCell;

thread_local! {
    static KEYGEN: RefCell<Option<Keygen>> = RefCell::new(None);
}

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn keygenRound0(parameters: JsValue, party_signup: JsValue) -> JsValue {
    let params: Params = parameters.into_serde().unwrap();
    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, _uuid) = (number, uuid);

    let mut messages: Vec<Msg<<Keygen as StateMachine>::MessageBody>> =
        Vec::new();

    // Initialize the state machine
    KEYGEN.with(|keygen| {
        let mut writer = keygen.borrow_mut();
        *writer = Some(
            Keygen::new(party_num_int, params.threshold, params.parties)
                .unwrap(),
        );

        let state = writer.as_mut().unwrap();
        if state.wants_to_proceed() {
            state.proceed().unwrap();
        }

        messages = state.message_queue().drain(..).collect::<Vec<_>>();
    });

    JsValue::from_serde(&messages).unwrap()
}
