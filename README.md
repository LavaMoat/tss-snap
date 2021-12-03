# ECDSA WASM

Demo for using [multi-party-ecdsa](https://github.com/ZenGo-X/multi-party-ecdsa) in WASM.

## Prerequisites

* `rust@1.54.0`
* `wasm-pack@0.9.1`
* `node@14.17.0`

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

If you get this error:

```
panicked at 'The global thread pool has not been initialized.: ThreadPoolBuildError { kind: IOError(Error { kind: Unsupported, message: "operation not supported on this platform" }) }', /home/muji/.cargo/registry/src/github.com-1ecc6299db9ec823/rayon-core-1.9.1/src/registry.rs:170:10
```

Then webassembly needs threads enabled, see:

* https://github.com/GoogleChromeLabs/wasm-bindgen-rayon
* https://rustwasm.github.io/wasm-bindgen/examples/raytrace.html
