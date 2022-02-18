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

static SIGN: Lazy<Arc<Mutex<Option<(OfflineStage, Vec<u16>)>>>> =
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
    /// Key share index for each signer.
    participants: Vec<u16>,
}

#[wasm_bindgen(js_name = "signInit")]
pub fn sign_init(index: JsValue, participants: JsValue, local_key: JsValue) {
    let index: u16 = index.into_serde().unwrap();
    let participants: Vec<u16> = participants.into_serde().unwrap();
    let local_key: LocalKey<Secp256k1> = local_key.into_serde().unwrap();
    let mut writer = SIGN.lock().unwrap();
    *writer = Some((
        OfflineStage::new(index, participants.clone(), local_key).unwrap(),
        participants,
    ));
}

#[wasm_bindgen(js_name = "signHandleIncoming")]
pub fn sign_handle_incoming(message: JsValue) {
    let message: Msg<<OfflineStage as StateMachine>::MessageBody> =
        message.into_serde().unwrap();
    let mut writer = SIGN.lock().unwrap();
    let (state, _) = writer.as_mut().unwrap();
    state.handle_incoming(message).unwrap();
}

#[wasm_bindgen(js_name = "signProceed")]
pub fn sign_proceed() -> JsValue {
    let mut writer = SIGN.lock().unwrap();
    let (state, _) = writer.as_mut().unwrap();
    state.proceed().unwrap();
    let messages = state.message_queue().drain(..).collect();
    let round = state.current_round();
    let messages = RoundMsg::from_round(round, messages);
    JsValue::from_serde(&(round, &messages)).unwrap()
}

#[wasm_bindgen(js_name = "signPartial")]
pub fn sign_partial(message: JsValue) -> JsValue {
    let message: String = message.into_serde().unwrap();

    let mut writer = SIGN.lock().unwrap();
    let (state, _) = writer.as_mut().unwrap();
    let completed_offline_stage = state.pick_output().unwrap().unwrap();
    let data = BigInt::from_bytes(message.as_bytes());
    let (_sign, partial) =
        SignManual::new(data.clone(), completed_offline_stage.clone()).unwrap();

    let mut writer = RESULT.lock().unwrap();
    *writer = Some((completed_offline_stage, data));

    JsValue::from_serde(&partial).unwrap()
}

#[wasm_bindgen(js_name = "signCreate")]
pub fn sign_create(partials: JsValue) -> JsValue {
    let partials: Vec<PartialSignature> = partials.into_serde().unwrap();

    let participants = {
        let reader = SIGN.lock().unwrap();
        let (_, participants) = reader.as_ref().unwrap();
        participants.clone()
    };

    let mut writer = RESULT.lock().unwrap();
    let state = writer.as_mut().unwrap();
    let (completed_offline_stage, data) = state;
    let pk = completed_offline_stage.public_key().clone();

    let (sign, _partial) =
        SignManual::new(data.clone(), completed_offline_stage.clone()).unwrap();

    let signature = sign.complete(&partials).unwrap();
    verify(&signature, &pk, &data).unwrap();

    let public_key = pk.to_bytes(false).to_vec();
    let result = SignResult {
        signature,
        address: crate::utils::address(&public_key),
        public_key,
        participants,
    };

    *writer = None;
    {
        let mut writer = SIGN.lock().unwrap();
        *writer = None;
    }

    JsValue::from_serde(&result).unwrap()
}
