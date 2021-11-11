# ECDSA WASM

Demo for using [multi-party-ecdsa](https://github.com/ZenGo-X/multi-party-ecdsa) in WASM.

* `rust@1.54.0`
* `wasm-pack@0.9.1`
* `node@14.17.0`

## Setup

```
# Build the wasm bindings
wasm-pack build
# Install the client dependencies
cd client && yarn install
```

## Start

```
# Start the server on ws://localhost:3030
cd server && cargo run
# Start the client on http://localhost:8080
cd client && yarn start
```

Now visit `http://localhost:8080`.
