FROM rust:1.40 as builder
WORKDIR /usr/src/ecdsa-wasm
COPY common common
COPY server server
RUN rustup override set nightly; \
    cargo install --path ./server

FROM debian:buster-slim
COPY --from=builder /usr/local/cargo/bin/ecdsa-wasm /usr/local/bin/ecdsa-wasm
CMD ecdsa-wasm --parties 3 --threshold 1 --bind 0.0.0.0:8080
