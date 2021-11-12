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
	@cd server && cargo run

client:
	@cd client && yarn start

.PHONY: all wasm setup build release server client
