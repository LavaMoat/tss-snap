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
COPY cli cli
RUN rustup default stable
RUN cargo install --path ./cli
RUN cargo install --version 0.10.3 wasm-pack
RUN mv ~/.cargo/bin/* /usr/bin
RUN mpc-websocket --version
RUN wasm-pack --version

# WASM
COPY packages/wasm packages/wasm
RUN rustup override set nightly
RUN rustup component add rust-src --toolchain nightly-x86_64-unknown-linux-gnu
RUN cd packages/wasm && wasm-pack build --target web --scope lavamoat

# CLIENT
FROM node:16-bullseye AS client
WORKDIR /usr/app
ARG SNAP_ID=npm:@lavamoat/tss-snap
ARG WS_URL=wss://tss.ac/mpc
ARG INFURA_API_KEY
ENV SNAP_ID=$SNAP_ID
ENV WS_URL=$WS_URL
ENV INFURA_API_KEY=$INFURA_API_KEY
COPY snap snap
COPY --from=builder /usr/app/packages/wasm /usr/app/packages/wasm
RUN cd snap/dapp && yarn install && yarn build:webpack

FROM debian:bullseye AS runner
WORKDIR /usr/app
COPY --from=builder /usr/bin/mpc-websocket /usr/bin/mpc-websocket
COPY --from=client /usr/app/snap/dapp/dist /usr/app/dist
CMD mpc-websocket --bind 0.0.0.0:8080 dist
