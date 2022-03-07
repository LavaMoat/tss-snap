use curv::{arithmetic::Converter, elliptic::curves::Secp256k1, BigInt};
use multi_party_ecdsa::protocols::multi_party_ecdsa::gg_2020::{
    party_i::{verify, SignatureRecid},
    state_machine::{
        keygen::LocalKey,
        sign::{
            CompletedOfflineStage, OfflineProtocolMessage, OfflineStage,
            PartialSignature, SignManual,
        },
    },
};

use once_cell::sync::Lazy;
use round_based::{Msg, StateMachine};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use wasm_bindgen::prelude::*;

//use crate::{console_log, log};

const ERR_NO_STATE_MACHINE: &str =
    "sign is not prepared, perhaps you forgot to call signInit()";

static SIGN: Lazy<Arc<Mutex<Option<OfflineStage>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

static RESULT: Lazy<Arc<Mutex<Option<(CompletedOfflineStage, BigInt)>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

/// Wrapper for a round `Msg` that includes the round
/// number so that we can ensure round messages are grouped
/// together and out of order messages can thus be handled correctly.
#[derive(Serialize)]
struct RoundMsg {
    round: u16,
    sender: u16,
    receiver: Option<u16>,
    body: OfflineProtocolMessage,
}

impl RoundMsg {
    fn from_round(
        round: u16,
        messages: Vec<Msg<<OfflineStage as StateMachine>::MessageBody>>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignResult {
    signature: SignatureRecid,
    #[serde(rename = "publicKey")]
    public_key: Vec<u8>,
    address: String,
}

#[wasm_bindgen(js_name = "signInit")]
pub fn sign_init(
    index: JsValue,
    participants: JsValue,
    local_key: JsValue,
) -> Result<(), JsError> {
    let index: u16 = index.into_serde()?;
    let participants: Vec<u16> = participants.into_serde()?;
    let local_key: LocalKey<Secp256k1> = local_key.into_serde()?;
    let mut writer = SIGN.lock()?;
    *writer = Some(OfflineStage::new(index, participants.clone(), local_key)?);
    Ok(())
}

#[wasm_bindgen(js_name = "signHandleIncoming")]
pub fn sign_handle_incoming(message: JsValue) -> Result<(), JsError> {
    let message: Msg<<OfflineStage as StateMachine>::MessageBody> =
        message.into_serde()?;
    let mut writer = SIGN.lock()?;
    let state = writer
        .as_mut()
        .ok_or_else(|| JsError::new(ERR_NO_STATE_MACHINE))?;
    state.handle_incoming(message)?;
    Ok(())
}

#[wasm_bindgen(js_name = "signProceed")]
pub fn sign_proceed() -> Result<JsValue, JsError> {
    let mut writer = SIGN.lock()?;
    let state = writer
        .as_mut()
        .ok_or_else(|| JsError::new(ERR_NO_STATE_MACHINE))?;
    if state.wants_to_proceed() {
        state.proceed()?;
        let messages = state.message_queue().drain(..).collect();
        let round = state.current_round();
        let messages = RoundMsg::from_round(round, messages);
        Ok(JsValue::from_serde(&(round, &messages))?)
    } else {
        Ok(JsValue::from_serde(&false)?)
    }
}

#[wasm_bindgen(js_name = "signPartial")]
pub fn sign_partial(message: JsValue) -> Result<JsValue, JsError> {
    let message: String = message.into_serde()?;

    let mut writer = SIGN.lock()?;
    let state = writer
        .as_mut()
        .ok_or_else(|| JsError::new(ERR_NO_STATE_MACHINE))?;
    let completed_offline_stage = state.pick_output().unwrap()?;
    let data = BigInt::from_bytes(message.as_bytes());
    let (_sign, partial) =
        SignManual::new(data.clone(), completed_offline_stage.clone())?;

    let mut writer = RESULT.lock()?;
    *writer = Some((completed_offline_stage, data));

    Ok(JsValue::from_serde(&partial)?)
}

#[wasm_bindgen(js_name = "signCreate")]
pub fn sign_create(partials: JsValue) -> Result<JsValue, JsError> {
    let partials: Vec<PartialSignature> = partials.into_serde()?;

    let mut writer = RESULT.lock()?;
    let state = writer
        .as_mut()
        .ok_or_else(|| JsError::new(ERR_NO_STATE_MACHINE))?;
    let (completed_offline_stage, data) = state;
    let pk = completed_offline_stage.public_key().clone();

    let (sign, _partial) =
        SignManual::new(data.clone(), completed_offline_stage.clone())?;

    let signature = sign.complete(&partials)?;
    verify(&signature, &pk, &data).map_err(|e| {
        JsError::new(&format!("failed to verify signature: {:?}", e))
    })?;

    let public_key = pk.to_bytes(false).to_vec();
    let result = SignResult {
        signature,
        address: crate::utils::address(&public_key),
        public_key,
    };

    *writer = None;
    {
        let mut writer = SIGN.lock()?;
        *writer = None;
    }

    Ok(JsValue::from_serde(&result)?)
}
