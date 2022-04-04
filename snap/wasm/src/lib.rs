//! Webassembly utilities for the threshold signatures snap.
#![deny(missing_docs)]
//use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

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

