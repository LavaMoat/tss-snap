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

## Structure

* `client`: Browser web application.
* `common`: Hack for webassembly compilation (see [common notes](#common)).
* `library`: Websocket server library.
* `server`: Command line interface for the server.
* `wasm`: Webassembly bindings to [multi-party-ecdsa][].

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

### Methods

An overview of the available [JSON-RPC][] methods.

#### Group.create

* `label`: Human-friendly `String` label for the group.
* `parameters`: Group parameters (`{threshold: u16, parties: u16}`).

Create a new group; the client that sends this method automatically joins the group.

Returns the UUID for the group.

#### Group.join

* `group_id`: The `String` UUID for the group.

Register the calling client as a member of the group.

Returns the group object.

#### Session.create

* `group_id`: The `String` UUID for the group.
* `kind`: The `String` kind of session (either `keygen` or `sign`).

Create a new session.

Returns the session object.

#### Session.join

* `group_id`: The `String` UUID for the group.
* `session_id`: The `String` UUID for the session.
* `kind`: The `String` kind of session (either `keygen` or `sign`).

Join an existing session.

Returns the session object.

#### Session.signup

* `group_id`: The `String` UUID for the group.
* `session_id`: The `String` UUID for the session.
* `kind`: The `String` kind of session (either `keygen` or `sign`).

Register as a co-operating party for a session.

When the required number of parties have signed up to a session a `sessionSignup` event is emitted to all the clients in the session. For key generation there must be `parties` clients in the session and for signing there must be `threshold + 1` clients registered for the session.

Returns the party signup number.

#### Session.load

* `group_id`: The `String` UUID for the group.
* `session_id`: The `String` UUID for the session.
* `kind`: The `String` kind of session (must be `keygen`).
* `number`: The `u16` party signup number.

Load a client into a given slot (party signup number). This is used to allow the party signup numbers allocated to saved key shares to be assigned and validated in the context of a session.

The given `number` must be in range and must be an available slot; calling this method with a `kind` other than `keygen` will result in an error.

When the required number of `parties` have been allocated to a session a `sessionLoad` event is emitted to all the clients in the session.

Returns the party signup number.

#### Session.message

* `group_id`: The `String` UUID for the group.
* `session_id`: The `String` UUID for the session.
* `kind`: The `String` kind of session (either `keygen` or `sign`).
* `message`: The message to broadcast or send peer to peer.

Relay a message to all the other peers in the session (broadcast) or send directly to another peer.

A `message` is treated as peer to peer when the `receiver` field is present which should be the party signup `number` for the peer.

This method is a notification and does not return anything to the caller.

#### Session.finish

* `group_id`: The `String` UUID for the group.
* `session_id`: The `String` UUID for the session.
* `number`: The `u16` party signup number.

Indicate the session has been finished for the calling client.

When all the clients in a session have called this method the server will emit a `sessionClosed` event to all the clients in the session.

This method is a notification and does not return anything to the caller.

#### Notify.proposal

* `group_id`: The `String` UUID for the group.
* `session_id`: The `String` UUID for the session.
* `proposal_id`: Unique identifier for the proposal.
* `message`: The message to be signed.

Sends a signing proposal to *all other clients in the group*. The event emitted is `notifyProposal` and the payload is an object with `sessionId`, `proposalId` and the `message` to be signed.

This method is a notification and does not return anything to the caller.

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
[multi-party-ecdsa]: https://github.com/ZenGo-X/multi-party-ecdsa
[playwright]: https://playwright.dev/
[JSON-RPC]: https://www.jsonrpc.org/specification
