all: build release

wasm:
	@cd wasm && wasm-pack build --target web

dist: wasm
	@cd client && yarn build

setup: wasm
	@cd client && yarn install && npx playwright install

build:
	@cd server && cargo build

release:
	@cd server && cargo build --release

server: client-release
	@cd server && cargo run

client:
	@cd client && yarn start

message:
	@cd common && cargo run --example message

fmt:
	@cd client && yarn prettier
	@cd server && cargo fmt
	@cd common && cargo fmt
	@cd wasm && cargo fmt

.PHONY: all wasm dist setup build release server client fmt
