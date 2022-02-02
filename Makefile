all: build release

wasm:
	@cd wasm && wasm-pack build --target web

wasm-gg2020:
	@cd wasm && wasm-pack build --target web -- --no-default-features --features gg2020

setup: wasm
	@cd client && yarn install

build:
	@cd server && cargo build

release:
	@cd server && cargo build --release

server: client-release
	@cd server && cargo run

client-release:
	@cd client && yarn build

client:
	@cd client && yarn start

message:
	@cd common && cargo run --example message

fmt:
	@cd client && yarn prettier
	@cd server && cargo fmt
	@cd common && cargo fmt
	@cd wasm && cargo fmt

.PHONY: all wasm wasm-gg2020 setup build release server client fmt
