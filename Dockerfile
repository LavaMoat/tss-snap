FROM rust:1.57-buster as builder
WORKDIR /usr/src/ecdsa-wasm
RUN apt-get update
# secp256k1-sys requires clang
RUN apt-get install -y pkg-config clang
COPY common common
COPY server server
COPY wasm wasm
RUN rustup override set nightly-2021-08-12;
RUN cargo install --path ./server;
RUN cargo install --version 0.10.1 wasm-pack;
RUN rustup component add rust-src --toolchain nightly-2021-08-12-x86_64-unknown-linux-gnu;
RUN cd wasm && wasm-pack build --target web;

FROM node:14 as client
WORKDIR /usr/src/ecdsa-wasm
COPY client client
COPY --from=builder /usr/src/ecdsa-wasm/wasm /usr/src/ecdsa-wasm/wasm
RUN cd client && yarn install && yarn build

FROM debian:buster-slim
WORKDIR /usr/app
COPY --from=builder /usr/local/cargo/bin/ecdsa-wasm /usr/local/bin/ecdsa-wasm
COPY --from=client /usr/src/ecdsa-wasm/client/dist /usr/app/client/dist
CMD ecdsa-wasm --parties 3 --threshold 1 --bind 0.0.0.0:8080 client/dist
