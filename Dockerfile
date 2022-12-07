FROM rust:1.65-buster AS rust

FROM debian:bullseye AS builder
WORKDIR /usr/app

# CLANG
RUN apt-get update
RUN apt-get install -y wget build-essential pkg-config libssl-dev binaryen

RUN printf "deb http://apt.llvm.org/bullseye/ llvm-toolchain-bullseye main\ndeb-src http://apt.llvm.org/bullseye/ llvm-toolchain-bullseye main\ndeb http://apt.llvm.org/bullseye/ llvm-toolchain-bullseye-12 main\ndeb-src http://apt.llvm.org/bullseye/ llvm-toolchain-bullseye-12 main" >> /etc/apt/sources.list

RUN wget -O - https://apt.llvm.org/llvm-snapshot.gpg.key | apt-key add -
RUN apt-get update
RUN apt-get install -y clang-12
RUN ln -s /usr/bin/clang-12 /usr/bin/clang
RUN clang --version

COPY --from=rust /usr/local/cargo /usr/local/cargo
ENV PATH=/usr/local/cargo/bin:$PATH

# SERVER
COPY getrandom getrandom
COPY cli cli
RUN rustup default stable
RUN cargo install --path ./cli
RUN cargo install --version 0.10.2 wasm-pack
RUN mv ~/.cargo/bin/* /usr/bin
RUN mpc-websocket --version
RUN wasm-pack --version

# WASM
COPY packages/wasm wasm
RUN rustup override set nightly
RUN rustup component add rust-src --toolchain nightly-aarch64-unknown-linux-gnu
RUN cd wasm && wasm-pack build --target web --scope lavamoat;

# CLIENT
FROM node:14 AS client
WORKDIR /usr/app
COPY demo demo
COPY --from=builder /usr/app/wasm /usr/app/wasm
RUN cd demo && yarn install && yarn build

FROM debian:bullseye AS runner
WORKDIR /usr/app
COPY --from=builder /usr/bin/mpc-websocket /usr/bin/mpc-websocket
COPY --from=client /usr/app/demo/dist /usr/app/demo/dist
CMD mpc-websocket --bind 0.0.0.0:8080 demo/dist
