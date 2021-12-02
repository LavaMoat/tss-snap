all: build release

wasm:
	@cd wasm && wasm-pack build

setup: wasm
	@cd client && yarn install

build:
	@cd server && cargo build

release:
	@cd server && cargo build --release

server:
	@cd server && cargo run -- --parties 3 --threshold 1

client:
	@cd client && yarn start

fmt:
	@cd client && yarn prettier
	@cd server && cargo fmt
	@cd common && cargo fmt
	@cd wasm && cargo fmt

.PHONY: all wasm setup build release server client fmt
