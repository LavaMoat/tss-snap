use serde::Serialize;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

use curv::{elliptic::curves::secp256_k1::Secp256k1, BigInt};
use round_based::{Msg, StateMachine};

use cggmp_threshold_ecdsa::presign::{
    PresigningOutput, PresigningTranscript, SSID,
};

use cggmp_threshold_ecdsa::sign::{
    state_machine::{self, ProtocolMessage},
    SigningOutput,
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
            Msg<<state_machine::Signing as StateMachine>::MessageBody>,
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

/// Sign using a presignature.
#[wasm_bindgen]
pub struct SignPresignature {
    inner: state_machine::Signing,
}

#[wasm_bindgen]
impl SignPresignature {
    /// Create a presignature state machine.
    #[wasm_bindgen(constructor)]
    pub fn new(
        ssid: JsValue,
        l: usize,
        m: JsValue,
        presigning_data: JsValue,
    ) -> Result<SignPresignature, JsError> {
        let ssid: SSID<Secp256k1> = serde_wasm_bindgen::from_value(ssid)?;
        let m: BigInt = serde_wasm_bindgen::from_value(m)?;
        let presigning_data: HashMap<
            u16,
            (PresigningOutput<Secp256k1>, PresigningTranscript<Secp256k1>),
        > = serde_wasm_bindgen::from_value(presigning_data)?;
        Ok(Self {
            inner: state_machine::Signing::new(ssid, l, m, presigning_data)?,
        })
    }

    /// Handle an incoming message.
    #[wasm_bindgen(js_name = "handleIncoming")]
    pub fn handle_incoming(
        &mut self,
        message: JsValue,
    ) -> Result<(), JsError> {
        let message: Msg<
            <state_machine::Signing as StateMachine>::MessageBody,
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

    /// Get the signature.
    pub fn signature(&mut self) -> Result<JsValue, JsError> {
        // Type declaration for clarity
        let signature: Option<SigningOutput<Secp256k1>> =
            self.inner.pick_output().unwrap()?;
        if let Some(signature) = signature {
            Ok(serde_wasm_bindgen::to_value(&signature)?)
        } else {
            Err(JsError::new("signature not available"))
        }
    }
}
