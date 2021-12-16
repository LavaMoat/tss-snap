# ECDSA WASM

Demo for using [multi-party-ecdsa](https://github.com/ZenGo-X/multi-party-ecdsa) (gg18) in WASM.

## Prerequisites

* `rust@1.54.0`
* `wasm-pack@0.10.1`
* `node@14.17.0`

To install a particular version of `wasm-pack`:

```
cargo install --version 0.10.1 wasm-pack
```

## Setup

```
make setup
```

## Serve

```
# Start the server on ws://localhost:3030
make server
# Start the client on http://localhost:8080
make client
```

The `make server` command starts the server configured for 3 parties with threshold 1 using the gg18 protocol so requires 2 parties to sign a message (threshold + 1).

***Warning:***: The server is stateful and not idempotent, it is best to run the demo from a clean server (re)start.

For example is you see an error like this:

```
panicked at 'index out of bounds: the len is 1 but the index is 1', src/keygen.rs:233:39
```

Try restarting the server.

## Demo

Now visit `http://localhost:8080`.

* Open 3 browser windows/tabs, one for each party
* Click the *Keygen Signup* button in each window/tab
* Once key generation is completed a form is presented to propose a message to sign, enter a message and submit the form
* Each browser window/tab should now show the message and a *Sign* button
* Click the *Sign* button in two browser windows/tabs to complete the demo

## Development

During development you should link the WASM module:

```
cd wasm/pkg && yarn link
cd client && yarn link ecdsa-wasm
```

## Notes

### Thread Support (Rayon)

Webassembly needs threads enabled, see:

* https://github.com/GoogleChromeLabs/wasm-bindgen-rayon
* https://rustwasm.github.io/wasm-bindgen/examples/raytrace.html

### Crypto.getRandomValues()

There is an error using `Crypto.getRandomValues()` with a `SharedArrayBuffer` when threads are enabled:

```
TypeError: Crypto.getRandomValues: Argument 1 can't be a SharedArrayBuffer or an ArrayBufferView backed by a SharedArrayBuffer
```

We are awaiting some PRs to be merged for a proper fix:

* https://github.com/rust-bitcoin/rust-secp256k1/pull/331
* https://github.com/algorand/pairing-plus/pull/22

In the meantime this hack works around the issue:

```javascript
// Temporary hack for getRandomValues() error
const getRandomValues = crypto.getRandomValues;
crypto.getRandomValues = function (buffer) {
  const array = new Uint8Array(buffer);
  const value = getRandomValues.call(crypto, array);
  buffer.set(value);
  return buffer;
};
```
