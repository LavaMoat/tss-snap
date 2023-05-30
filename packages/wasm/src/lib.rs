//! Webassembly bindings to the GG2020 protocol in [multi-party-ecdsa](https://github.com/ZenGo-X/multi-party-ecdsa) for MPC key generation and signing.
#![deny(missing_docs)]
use wasm_bindgen::prelude::*;

extern crate wasm_bindgen;

#[cfg(all(test, target_arch = "wasm32"))]
extern crate wasm_bindgen_test;

#[doc(hidden)]
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
    if wasm_log::try_init(wasm_log::Config::new(log::Level::Debug)).is_ok() {
        log::info!("WASM logger initialized");
    }
    log::info!("WASM: module started {:?}", std::thread::current().id());
}

mod cggmp;
mod gg2020;
mod utils;

// Expose these types for API documentation.
pub use gg2020::keygen::KeyGenerator;
pub use gg2020::sign::{Signature, Signer};
pub use utils::*;

/// Compute the Keccak256 hash of a value.
#[wasm_bindgen]
pub fn keccak256(message: JsValue) -> Result<JsValue, JsError> {
    use sha3::{Digest, Keccak256};
    let message: Vec<u8> = serde_wasm_bindgen::from_value(message)?;
    let digest = Keccak256::digest(message).to_vec();
    Ok(serde_wasm_bindgen::to_value(&digest)?)
}
