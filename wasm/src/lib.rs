//! Webassembly bindings for the GG2020 protocol in [multi-party-ecdsa](https://github.com/ZenGo-X/multi-party-ecdsa) for MPC key generation and signing.
#![deny(missing_docs)]
use sha2::{Digest, Sha256};
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

pub use gg2020::keygen::KeyGenerator;
pub use gg2020::sign::Signer;

#[doc(hidden)]
#[wasm_bindgen]
pub fn sha256(message: JsValue) -> Result<JsValue, JsError> {
    let message: String = message.into_serde()?;
    let mut hasher = Sha256::new();
    hasher.update(&message);
    Ok(JsValue::from_serde(&hex::encode(hasher.finalize()))?)
}
