use wasm_bindgen_test::*;
//wasm_bindgen_test::wasm_bindgen_test_configure!(run_in_browser);
use ecdsa_wasm::{aes_decrypt, aes_encrypt};

#[wasm_bindgen_test]
fn test_encrypt_decrypt() {
    let key = b"an example very very secret key.";
    let value = b"plaintext message";
    let aead = aes_encrypt(key, value);
    let plaintext = aes_decrypt(key, aead);
    assert_eq!(&plaintext, value);
}
