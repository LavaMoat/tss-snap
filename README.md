# ECDSA WASM

Demo for using [multi-party-ecdsa](https://github.com/ZenGo-X/multi-party-ecdsa) (GG2020) in WASM.

## Prerequisites

* `rust@1.54.0`
* `wasm-pack@0.10.2`
* `node@14.17.0`

To install a particular version of `wasm-pack`:

```
cargo install --version 0.10.2 wasm-pack
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
(cd wasm/pkg && yarn link)
(cd client && yarn link ecdsa-wasm)
```

## Test

To run the test suite using [playwright][] open two terminal sessions:

```
make test-server     # start the backend server
make test            # run the tests
```

If you want to see the tests execute in a browser run `make test-headed`.

To hack on the code whilst running the tests open several terminal sessions:

```
cd server && cargo run
cd client && yarn start
cd client && TEST_URL=http://localhost:8080 yarn test
```

## Docker

For deployment or if you don't want to install the rust toolchain and are just working on the client code you can build and run a docker image:

```
docker build . -t ecdsa-wasm
docker run -p 3030:8080 -it ecdsa-wasm
```

Now you can view the demo at `http://localhost:3030`.

The docker file is designed for `x86_64`, if you need to build for ARM architectures like the M1, replace this line:

```
RUN rustup component add rust-src --toolchain nightly-2021-08-12-x86_64-unknown-linux-gnu;
```

With the `aarch64` architecture:

```
RUN rustup component add rust-src --toolchain nightly-2021-08-12-aarch64-unknown-linux-gnu;
```

## API Documentation

To view the API documentation for the websocket server:

```
(cd server && cargo doc --open --no-deps)
```

To view the API documentation for the webassembly bindings run:

```
(cd wasm && cargo doc --open --no-deps)
```

## Server

The server exposes a websocket endpoint at `/mpc` that clients can use to create groups and sessions that are used to facilitate communication between co-operating parties.

A group represents a collection of connected clients that are co-operating within the context of the group parameters `t` and `n` where `t` is the threshold and `n` is the total number of parties.

Groups may contain sessions that can be used for key generation and signing. A key generation session expects `n` parties whilst a signing session expects `t + 1` parties to co-operate.

## Notes

### Common

The common library contains a little code shared between the webassembly and server modules which we could easily duplicate however it serves another important purpose. It includes a hack for the dependency tree including multiple versions of `getrandom`:

```
getrandom:0.1.16
getrandom:0.2.5
```

Version `0.2` of `getrandom` requires a `js` feature enabled to compile for wasm32 so we set that in `common`:

```toml
getrandom = {version = "0.2", features = ["js"]}
```

But the websassembly modules cannot use this version of `getrandom` yet so it includes the older version:

```toml
getrandom = {version = "0.1.16", features = ["wasm-bindgen"]}
```

Once [this PR](https://github.com/rust-bitcoin/rust-secp256k1/pull/331) is merged and the dependency tree is updated we should be able to update `getrandom` and remove this hack.

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

[playwright]: https://playwright.dev/
