FROM rust:1.40 as builder
WORKDIR /usr/src/ecdsa-wasm
COPY common common
COPY server server
RUN rustup override set nightly; \
    cargo install --path ./server

FROM node:14 as client
WORKDIR /usr/src/ecdsa-wasm
COPY client client
RUN cd client && yarn install && yarn build

FROM debian:buster-slim
WORKDIR /usr/app
COPY --from=builder /usr/local/cargo/bin/ecdsa-wasm /usr/local/bin/ecdsa-wasm
COPY --from=client /usr/src/ecdsa-wasm/client/dist /usr/app/client/dist
CMD ecdsa-wasm --parties 3 --threshold 1 --bind 0.0.0.0:8080 client/dist
