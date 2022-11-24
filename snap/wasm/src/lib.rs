//! Webassembly utilities for the threshold signatures snap.
#![deny(missing_docs)]
use serde::{Deserialize, Serialize};
use thiserror::Error;
use wasm_bindgen::prelude::*;

use curv::elliptic::curves::secp256_k1::Secp256k1;
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2020::state_machine::keygen::LocalKey;

extern crate wasm_bindgen;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[doc(hidden)]
#[macro_export]
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[doc(hidden)]
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
    wasm_logger::init(wasm_logger::Config::new(log::Level::Debug));
    //console_log!("WASM: module started {:?}", std::thread::current().id());
}

/// Key share with a human-friendly label.
#[derive(Serialize, Deserialize)]
pub struct NamedKeyShare {
    label: String,
    share: KeyShare,
}

// TODO: share this KeyShare type with the main MPC webassembly module

/// Generated key share.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KeyShare {
    /// The secret private key.
    #[serde(rename = "localKey")]
    pub local_key: LocalKey<Secp256k1>,
    /// The public key.
    #[serde(rename = "publicKey")]
    pub public_key: Vec<u8>,
    /// Address generated from the public key.
    pub address: String,
}

/// Error thrown by the library.
#[derive(Debug, Error)]
pub enum Error {}

/// Export a key share as an encrypted web3 keystore.
#[wasm_bindgen(js_name = "exportKeyStore")]
pub fn export_key_store(
    address: JsValue,
    passphrase: JsValue,
    key_share: JsValue,
) -> Result<JsValue, JsError> {
    use web3_keystore::encrypt;
    let address: String = address.into_serde()?;
    let passphrase: String = passphrase.into_serde()?;
    let key_share: NamedKeyShare = key_share.into_serde()?;
    let key_share = serde_json::to_vec(&key_share)?;
    let mut rng = rand::thread_rng();
    let keystore = encrypt(&mut rng, key_share, &passphrase, Some(address))?;
    Ok(JsValue::from_serde(&keystore)?)
}

/// Import an encrypted web3 keystore as a named key share.
#[wasm_bindgen(js_name = "importKeyStore")]
pub fn import_key_store(
    passphrase: JsValue,
    key_store: JsValue,
) -> Result<JsValue, JsError> {
    use web3_keystore::{decrypt, KeyStore};
    let passphrase: String = passphrase.into_serde()?;
    let key_store: KeyStore = key_store.into_serde()?;
    let json_data = decrypt(&key_store, &passphrase)?;
    let key_share: NamedKeyShare = serde_json::from_slice(&json_data)?;
    Ok(JsValue::from_serde(&key_share)?)
}
