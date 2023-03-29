wasm:
	@cd packages/wasm && wasm-pack build --target web --scope lavamoat

snap-wasm:
	@cd snap/wasm && wasm-pack build --target web --scope lavamoat

dist: wasm
	@cd snap/dapp && yarn clean && yarn build

setup: wasm snap-wasm
	@cd packages/wasm/pkg && yarn install
	@cd packages/client && yarn install
	@cd snap/dapp && yarn install
	@cd snap/wasm/pkg && yarn install

build:
	@cd cli && cargo build

release: dist
	@cd cli && cargo build --release

server: dist
	@cd cli && cargo run

test-server: dist-dev
	@cd cli && cargo run

#test:
	#@cd demo && yarn test

#test-headed:
	#@cd demo && yarn test-headed

lint:
	@cd packages/client && yarn lint
	@cd snap/dapp  && yarn lint

fmt: lint
	@cd library && cargo fmt
	@cd cli && cargo fmt
	@cd packages/wasm && cargo fmt
	@cd snap/wasm && cargo fmt

.PHONY: wasm snap-wasm dist dist-dev setup build release server test lint fmt
