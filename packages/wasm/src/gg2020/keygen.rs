//! Key generation.
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2020::state_machine::keygen::{
    Keygen, ProtocolMessage,
};

use wasm_bindgen::prelude::*;

use crate::{KeyShare, Parameters, PartySignup};
use serde::Serialize;

use round_based::{Msg, StateMachine};

//use crate::{console_log, log};

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
        messages: Vec<Msg<<Keygen as StateMachine>::MessageBody>>,
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

/// Round-based key share generator.
#[wasm_bindgen]
pub struct KeyGenerator {
    inner: Keygen,
}

#[wasm_bindgen]
impl KeyGenerator {
    /// Create a key generator.
    #[wasm_bindgen(constructor)]
    pub fn new(
        parameters: JsValue,
        party_signup: JsValue,
    ) -> Result<KeyGenerator, JsError> {
        let params: Parameters = serde_wasm_bindgen::from_value(parameters)?;
        let PartySignup { number, uuid } =
            serde_wasm_bindgen::from_value(party_signup)?;
        let (party_num_int, _uuid) = (number, uuid);
        Ok(Self {
            inner: Keygen::new(
                party_num_int,
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
        let message: Msg<<Keygen as StateMachine>::MessageBody> =
            serde_wasm_bindgen::from_value(message)?;
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

    /// Create the key share.
    pub fn create(&mut self) -> Result<JsValue, JsError> {
        let local_key = self.inner.pick_output().unwrap()?;
        let key_share: KeyShare = local_key.into();
        Ok(serde_wasm_bindgen::to_value(&key_share)?)
    }
}
