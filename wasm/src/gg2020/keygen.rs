use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2020::state_machine::keygen::Keygen;

use wasm_bindgen::prelude::*;

use common::PartySignup;

use crate::utils::Params;
use round_based::{Msg, StateMachine};

use once_cell::sync::Lazy;
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use crate::{console_log, log};

static KEYGEN: Lazy<Pin<Arc<Mutex<Option<Keygen>>>>> =
    Lazy::new(|| Pin::new(Arc::new(Mutex::new(None))));

#[wasm_bindgen(js_name = "initKeygen")]
pub fn init_keygen(parameters: JsValue, party_signup: JsValue) {
    let params: Params = parameters.into_serde().unwrap();
    let PartySignup { number, uuid } =
        party_signup.into_serde::<PartySignup>().unwrap();
    let (party_num_int, _uuid) = (number, uuid);

    let mut writer = KEYGEN.lock().unwrap();
    *writer = Some(
        Keygen::new(party_num_int, params.threshold, params.parties).unwrap(),
    );

    let mem_addr = &writer as *const _;
    console_log!("WASM Keygen addr (init): {:?}", mem_addr);

    //let state = writer.as_mut().unwrap();
    //console_log!("Messages received {:#?}", state.msgs1.as_ref().unwrap().messages_received());
}

#[wasm_bindgen(js_name = "startKeygen")]
pub fn start_keygen() -> JsValue {
    let mut writer = KEYGEN.lock().unwrap();

    let mem_addr = &writer as *const _;
    console_log!("WASM Keygen addr (start): {:?}", mem_addr);

    let state = writer.as_mut().unwrap();
    if state.wants_to_proceed() {
        state.proceed().unwrap();
    }
    let messages: Vec<Msg<<Keygen as StateMachine>::MessageBody>> =
        state.message_queue().drain(..).collect();
    JsValue::from_serde(&messages).unwrap()
}

#[wasm_bindgen(js_name = "handleKeygenIncoming")]
pub fn handle_keygen_incoming(message: JsValue) {
    let message: Msg<<Keygen as StateMachine>::MessageBody> =
        message.into_serde().unwrap();

    let mut writer = KEYGEN.lock().unwrap();

    let mem_addr = &writer as *const _;
    console_log!("WASM Keygen addr (handle_incoming): {:?}", mem_addr);

    let state = writer.as_mut().unwrap();
    state.handle_incoming(message).unwrap();

    console_log!("Handle incoming {:?}", state.wants_to_proceed());
    //console_log!("Messages received {:#?}", state.msgs1.as_ref().unwrap().messages_received());
}

#[wasm_bindgen(js_name = "keygenWantsToProceed")]
pub fn keygen_wants_to_proceed() -> JsValue {
    let mut writer = KEYGEN.lock().unwrap();
    let state = writer.as_mut().unwrap();
    let wants = state.wants_to_proceed();

    JsValue::from_serde(&wants).unwrap()
}

#[wasm_bindgen(js_name = "keygenCurrentRound")]
pub fn keygen_current_round() -> JsValue {
    let mut writer = KEYGEN.lock().unwrap();
    let state = writer.as_mut().unwrap();
    let current = state.current_round();
    JsValue::from_serde(&current).unwrap()
}

#[wasm_bindgen(js_name = "keygenProceed")]
pub fn keygen_proceed() -> JsValue {
    let mut writer = KEYGEN.lock().unwrap();

    let mem_addr = &writer as *const _;
    console_log!("WASM Keygen addr (proceed): {:?}", mem_addr);

    let state = writer.as_mut().unwrap();
    state.proceed().unwrap();
    let messages: Vec<Msg<<Keygen as StateMachine>::MessageBody>> =
        state.message_queue().drain(..).collect();
    JsValue::from_serde(&messages).unwrap()
}
