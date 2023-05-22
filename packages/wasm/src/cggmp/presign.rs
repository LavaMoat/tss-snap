use serde::Serialize;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

use curv::elliptic::curves::secp256_k1::Secp256k1;
use round_based::{Msg, StateMachine};

use crate::{Parameters, KeyShare};
use cggmp_threshold_ecdsa::presign::{self, ProtocolMessage};

/// Wrapper for a round `Msg` that includes the round
/// number so that we can ensure round messages are grouped
/// together and out of order messages can thus be handled correctly.
#[derive(Serialize)]
struct RoundMsg {
    round: u16,
    sender: u16,
    receiver: Option<u16>,
    body: ProtocolMessage,
}

impl RoundMsg {
    fn from_round(
        round: u16,
        messages: Vec<
            Msg<<state_machine::PreSigning as StateMachine>::MessageBody>,
        >,
    ) -> Vec<Self> {
        messages
            .into_iter()
            .map(|m| RoundMsg {
                round,
                sender: m.sender,
                receiver: m.receiver,
                body: m.body,
            })
            .collect::<Vec<_>>()
    }
}

/// Pre signing wrapper.
#[wasm_bindgen]
pub struct PreSigning {
    inner: state_machine::PreSigning,
}

#[wasm_bindgen]
impl PreSigning {
    /// Create a key refresh.
    #[wasm_bindgen(constructor)]
    pub fn new(
        parameters: JsValue,
        local_key: JsValue,
        new_party_index: JsValue,
        old_to_new: JsValue,
    ) -> Result<KeyRefresh, JsError> {
        let params: Parameters = serde_wasm_bindgen::from_value(parameters)?;
        let local_key: Option<LocalKey<Secp256k1>> =
            serde_wasm_bindgen::from_value(local_key)?;
        let new_party_index: Option<u16> =
            serde_wasm_bindgen::from_value(new_party_index)?;
        let old_to_new: HashMap<u16, u16> =
            serde_wasm_bindgen::from_value(old_to_new)?;

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

    /// Handle an incoming message.
    #[wasm_bindgen(js_name = "handleIncoming")]
    pub fn handle_incoming(
        &mut self,
        message: JsValue,
    ) -> Result<(), JsError> {
        let message: Msg<
            <state_machine::KeyRefresh as StateMachine>::MessageBody,
        > = serde_wasm_bindgen::from_value(message)?;
        self.inner.handle_incoming(message)?;
        Ok(())
    }

    /// Proceed to the next round.
    pub fn proceed(&mut self) -> Result<JsValue, JsError> {
        self.inner.proceed()?;
        let messages = self.inner.message_queue().drain(..).collect();
        let round = self.inner.current_round();
        let messages = RoundMsg::from_round(round, messages);
        Ok(serde_wasm_bindgen::to_value(&(round, &messages))?)
    }

    /// Get the key share.
    pub fn create(&mut self) -> Result<JsValue, JsError> {
        let local_key = self.inner.pick_output().unwrap()?;
        let key_share: KeyShare = local_key.into();
        Ok(serde_wasm_bindgen::to_value(&key_share)?)
    }
}
