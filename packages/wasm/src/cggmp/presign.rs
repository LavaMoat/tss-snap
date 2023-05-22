use serde::Serialize;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

use curv::{elliptic::curves::secp256_k1::Secp256k1, BigInt};
use round_based::{Msg, StateMachine};

use cggmp_threshold_ecdsa::presign::{
    state_machine::{self, ProtocolMessage},
    PreSigningSecrets, SSID, PresigningOutput, PresigningTranscript,
};

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
    /// Create a presignature state machine.
    #[wasm_bindgen(constructor)]
    pub fn new(
        ssid: JsValue,
        secrets: JsValue,
        s: JsValue,
        t: JsValue,
        n_hats: JsValue,
        l: usize,
    ) -> Result<PreSigning, JsError> {
        let ssid: SSID<Secp256k1> = serde_wasm_bindgen::from_value(ssid)?;
        let secrets: PreSigningSecrets =
            serde_wasm_bindgen::from_value(secrets)?;
        let s: HashMap<u16, BigInt> = serde_wasm_bindgen::from_value(s)?;
        let t: HashMap<u16, BigInt> = serde_wasm_bindgen::from_value(t)?;
        let n_hats: HashMap<u16, BigInt> =
            serde_wasm_bindgen::from_value(n_hats)?;
        Ok(Self {
            inner: state_machine::PreSigning::new(
                ssid, secrets, s, t, n_hats, l,
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
            <state_machine::PreSigning as StateMachine>::MessageBody,
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

    /// Get the presignature.
    pub fn presignature(&mut self) -> Result<JsValue, JsError> {
        // Type declaration for clarity
        let presignature: Option<(
            PresigningOutput<Secp256k1>,
            PresigningTranscript<Secp256k1>,
        )> = self.inner.pick_output().unwrap()?;
        if let Some(presignature) = presignature {
            Ok(serde_wasm_bindgen::to_value(&presignature)?)
        } else {
            Err(JsError::new("presignature not available"))
        }
    }
}
