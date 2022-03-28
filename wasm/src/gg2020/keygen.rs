//! Key generation.
use curv::elliptic::curves::secp256_k1::Secp256k1;
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2020::state_machine::keygen::{
    Keygen, LocalKey, ProtocolMessage,
};

use wasm_bindgen::prelude::*;

use crate::Parameters;
use serde::{Deserialize, Serialize};

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

/// Session information for a single party.
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub struct PartySignup {
    /// Unique index for the party.
    pub number: u16,
    /// Session identifier.
    pub uuid: String,
}

/// Generated key share.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KeyShare {
    /// The secret private key.
    #[serde(rename = "localKey")]
    pub local_key: LocalKey<Secp256k1>,
    /// The public key.
    #[serde(rename = "publicKey")]
    pub public_key: Vec<u8>,
    /// Address generated from the public key.
    pub address: String,
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
    pub fn new(parameters: JsValue, party_signup: JsValue) -> Result<KeyGenerator, JsError> {
        let params: Parameters = parameters.into_serde()?;
        let PartySignup { number, uuid } = party_signup.into_serde::<PartySignup>()?;
        let (party_num_int, _uuid) = (number, uuid);
        Ok(Self {
            inner: Keygen::new(party_num_int, params.threshold, params.parties)?,
        })
    }

    /// Handle an incoming message.
    #[wasm_bindgen(js_name = "handleIncoming")]
    pub fn handle_incoming(&mut self, message: JsValue) -> Result<(), JsError> {
        let message: Msg<<Keygen as StateMachine>::MessageBody> = message.into_serde()?;
        self.inner.handle_incoming(message)?;
        Ok(())
    }

    /// Proceed to the next round.
    pub fn proceed(&mut self) -> Result<JsValue, JsError> {
        self.inner.proceed()?;
        let messages = self.inner.message_queue().drain(..).collect();
        let round = self.inner.current_round();
        let messages = RoundMsg::from_round(round, messages);
        Ok(JsValue::from_serde(&(round, &messages))?)
    }

    /// Create the key share.
    pub fn create(&mut self) -> Result<JsValue, JsError> {
        let local_key = self.inner.pick_output().unwrap()?;
        let public_key = local_key.public_key().to_bytes(false).to_vec();
        let key_share = KeyShare {
            local_key,
            address: crate::utils::address(&public_key),
            public_key,
        };
        Ok(JsValue::from_serde(&key_share)?)
    }
}
