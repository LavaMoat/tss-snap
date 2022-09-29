# ECDSA WASM

Demo for using [multi-party-ecdsa][] (GG2020) in WASM.

## Prerequisites

* `rust@1.54.0`
* `wasm-pack@0.10.2`
* `node@14.17.0`

To install a particular version of `wasm-pack`:

```
cargo install --version 0.10.2 wasm-pack
```

Note: when you run the command in the project directory, you may run into an error `The package requires the Cargo feature called edition2021, but that feature is not stablized in this version of Cargo (1.56.0-nightly (cc17afbb0 2021-08-02)).` 

This is because `rust-toolchain` specifies an overriding cargo version of `nightly-2021-08-12`.

To fix this, run `cargo install --version 0.10.2 wasm-pack` again outside the current directory. 

Note: installation was successful using `cargo 1.65.0-nightly (4ed54cecc 2022-08-27)`.

## Structure

* `cli`: Command line interface for the server.
* `demo`: Browser web application.
* `getrandom`: Hack for webassembly compilation (see [getrandom notes](#getrandom)).
* `library`: Websocket server library.
* `snap`: Experimental snap for MetaMask.
* `packages`: Javascript packages and webassembly bindings to [multi-party-ecdsa][].

## Setup

```
make setup
cd packages/client && yarn build && yarn link && cd ../..
cd demo && yarn link @metamask/mpc-client && cd ..
```

## Serve

```
# Start the server on ws://localhost:3030
make server
# Start the client on http://localhost:8080
make demo
```

Now visit `http://localhost:8080`.

## Development

During development you should link the WASM module and Javascript client package:

```
(cd packages/wasm/pkg && yarn link)
(cd demo && yarn link @metamask/mpc-ecdsa-wasm)

(cd packages/client && yarn link)
(cd demo && yarn link @metamask/mpc-client)
```

To work on the snap there are some additional webassembly utilities used for encrypting and decrypting key shares:

```
(cd snap/wasm/pkg && yarn link)
(cd snap/dapp && yarn link @metamask/mpc-snap-wasm)
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
cd cli && cargo run
cd demo && yarn start
cd demo && TEST_URL=http://localhost:8080 yarn test
```

Networking is racy and we have fixed quite a few race conditions so to it is a good idea to run the tests lots of times:

```
make test-server                # start the backend server
(cd demo && ./test.sh)        # run the tests 100 times
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
(cd library && cargo doc --open --no-deps)
```

To view the API documentation for the webassembly bindings run:

```
(cd wasm && cargo doc --open --no-deps)
```

## Server

Static files are served from a given filesystem path and the `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` headers are set to enable the use of `SharedArrayBuffer`, see [Cross-Origin-Embedder-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy) for more information. It is a requirement that `SharedArrayBuffer` is available as the webassembly module requires threads so if you wish to serve assets from another web server or CDN then you need to ensure those headers are set correctly.

A websocket endpoint at the path `/mpc` is exposed so that clients can create groups and sessions that are used to facilitate communication between co-operating parties. Uses [JSON-RPC][] for communication.

A group represents a collection of connected clients that are co-operating within the context of the group parameters `t` and `n` where `t` is the threshold and `n` is the total number of parties.

Groups may contain sessions that can be used for key generation and signing. A key generation session expects `n` parties whilst a signing session expects `t + 1` parties to co-operate.

For ease of deployment groups are stored in memory and removed when there are no more connected clients; whilst this is convenient as it means there is no dependency on a caching layer such as [redis](https://redis.io) it means that it is not possible to provide persistent groups which could be problematic if clients have poor network connections. A more resilient, fault tolerant design would store the groups and sessions in a cache and allow for re-connection to an existing group.

See the [API Documentation](https://docs.rs/mpc-websocket/latest/mpc_websocket/) and the [services module](https://docs.rs/mpc-websocket/latest/mpc_websocket/services/index.html) for information on the available JSON-RPC methods.

## Notes

### Getrandom

The getrandom library contains a hack for the dependency tree including multiple versions of `getrandom`:

```
getrandom:0.1.16
getrandom:0.2.5
```

Version `0.2` of `getrandom` requires a `js` feature enabled to compile for wasm32 so we set that in `mpc-ecdsa-getrandom-hack`:

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
[multi-party-ecdsa]: https://github.com/ZenGo-X/multi-party-ecdsa
[playwright]: https://playwright.dev/
[JSON-RPC]: https://www.jsonrpc.org/specification
