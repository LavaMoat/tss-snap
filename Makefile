wasm:
	@cd packages/wasm && wasm-pack build --target web --scope lavamoat

snap-wasm:
	@cd snap/wasm && wasm-pack build --target web --scope lavamoat

dist: wasm
	@cd demo && yarn build

dist-dev: wasm
	@cd demo && yarn build:dev

setup: wasm snap-wasm
	@cd demo && yarn install && npx playwright install
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

demo:
	@cd demo && yarn start

test-server: dist-dev
	@cd cli && cargo run

test:
	@cd demo && yarn test

test-headed:
	@cd demo && yarn test-headed

lint:
	@cd demo && yarn lint
	@cd packages/client && yarn lint
	@cd snap/dapp  && yarn lint

fmt: lint
	@cd demo && yarn fmt
	@cd library && cargo fmt
	@cd cli && cargo fmt
	@cd packages/wasm && cargo fmt
	@cd snap/wasm && cargo fmt

.PHONY: wasm snap-wasm dist dist-dev setup build release server demo test lint fmt
