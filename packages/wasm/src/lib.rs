//! Webassembly bindings to the GG2020 protocol in [multi-party-ecdsa](https://github.com/ZenGo-X/multi-party-ecdsa) for MPC key generation and signing.
#![deny(missing_docs)]
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

extern crate wasm_bindgen;

#[cfg(all(test, target_arch = "wasm32"))]
extern crate wasm_bindgen_test;

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
    console_log!("WASM: module started {:?}", std::thread::current().id());
}

// Required for rayon thread support
pub use wasm_bindgen_rayon::init_thread_pool;

mod gg2020;
mod utils;

// Expose these types for API documentation.
pub use gg2020::keygen::{KeyGenerator, KeyShare, PartySignup};
pub use gg2020::sign::{Signature, Signer};

/// Parameters used during key generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameters {
    /// Number of parties `n`.
    pub parties: u16,
    /// Threshold for signing `t`.
    ///
    /// The threshold must be crossed (`t + 1`) for signing
    /// to commence.
    pub threshold: u16,
}

impl Default for Parameters {
    fn default() -> Self {
        return Self {
            parties: 3,
            threshold: 1,
        };
    }
}

/// Compute the Keccak256 hash of a value.
#[wasm_bindgen]
pub fn keccak256(message: JsValue) -> Result<JsValue, JsError> {
    use sha3::{Digest, Keccak256};
    let message: Vec<u8> = message.into_serde()?;
    let digest = Keccak256::digest(&message).to_vec();
    Ok(JsValue::from_serde(&digest)?)
}
