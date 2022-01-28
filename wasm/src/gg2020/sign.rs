use curv::elliptic::curves::Secp256k1;
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2020::state_machine::{
    keygen::LocalKey, sign::OfflineStage,
};

use std::sync::{Arc, Mutex};

use once_cell::sync::Lazy;

use wasm_bindgen::prelude::*;

static SIGN: Lazy<Arc<Mutex<Option<OfflineStage>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

#[wasm_bindgen(js_name = "signInit")]
pub fn sign_init(index: JsValue, participants: JsValue, local_key: JsValue) {
    let index: u16 = index.into_serde().unwrap();
    let participants: Vec<u16> = participants.into_serde().unwrap();
    let local_key: LocalKey<Secp256k1> = local_key.into_serde().unwrap();

    let mut writer = SIGN.lock().unwrap();
    *writer = Some(OfflineStage::new(index, participants, local_key).unwrap());
}
