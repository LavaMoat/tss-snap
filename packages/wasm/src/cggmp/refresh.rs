use std::collections::HashMap;
use wasm_bindgen::prelude::*;

use curv::elliptic::curves::secp256_k1::Secp256k1;

use crate::Parameters;
use cggmp_threshold_ecdsa::refresh::state_machine;

use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2020::state_machine::keygen::LocalKey;

/// Key refresh.
#[wasm_bindgen]
pub struct KeyRefresh {
    inner: state_machine::KeyRefresh,
}

#[wasm_bindgen]
impl KeyRefresh {
    /// Create a key refresh.
    #[wasm_bindgen(constructor)]
    pub fn new(
        parameters: JsValue,
        local_key: JsValue,
        new_party_index: JsValue,
        old_to_new: JsValue,
    ) -> Result<KeyRefresh, JsError> {
        let params: Parameters = serde_wasm_bindgen::from_value(parameters)?;
        let local_key: Option<LocalKey<Secp256k1>> = serde_wasm_bindgen::from_value(local_key)?;
        let new_party_index: Option<u16> = serde_wasm_bindgen::from_value(new_party_index)?;
        let old_to_new: HashMap<u16, u16> = serde_wasm_bindgen::from_value(old_to_new)?;

        Ok(Self {
            inner: state_machine::KeyRefresh::new(
                local_key,
                new_party_index,
                &old_to_new,
                params.threshold,
                params.parties,
            )?,
        })
    }
}
