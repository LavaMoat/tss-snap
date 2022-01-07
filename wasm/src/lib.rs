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

#[macro_export]
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
    console_log!("WASM: module started.");
}

// Required for rayon thread support
pub use wasm_bindgen_rayon::init_thread_pool;

mod keygen;
mod sign;
mod utils;

#[allow(non_snake_case)]
#[wasm_bindgen]
pub fn sha256(message: JsValue) -> JsValue {
    let message: String = message.into_serde::<String>().unwrap();
    let mut hasher = Sha256::new();
    hasher.update(&message);
    let result = hex::encode(hasher.finalize());
    JsValue::from_serde(&result).unwrap()
}
