wasm:
	@cd packages/wasm && wasm-pack build --target web --scope metamask

snap-wasm:
	@cd snap/wasm && wasm-pack build --target web --scope metamask

dist: wasm
	@cd demo && yarn build

dist-dev: wasm
	@cd demo && yarn build:dev

module:
	@cd module && yarn build

setup: wasm snap-wasm module
	@cd demo && yarn install && npx playwright install
	@cd module && yarn install
	@cd snap/rpc && yarn install
	@cd snap/ui && yarn install

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
	@cd demo && yarn lint:eslint
	@cd packages/client && yarn lint:eslint

fmt: lint
	@cd demo && yarn prettier
	@cd library && cargo fmt
	@cd cli && cargo fmt
	@cd packages/wasm && cargo fmt

.PHONY: wasm snap-wasm dist dist-dev module setup build release server demo test lint fmt
