# ECDSA WASM

Demo for using [multi-party-ecdsa](https://github.com/ZenGo-X/multi-party-ecdsa) in WASM.

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

Now visit `http://localhost:8080`.

## Development

During development you should link the WASM module:

```
cd wasm/pkg && yarn link
cd client && yarn link ecdsa-wasm
```

## Thread Support (Rayon)

Webassembly needs threads enabled, see:

* https://github.com/GoogleChromeLabs/wasm-bindgen-rayon
* https://rustwasm.github.io/wasm-bindgen/examples/raytrace.html

## Notes

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
