wasm:
	@cd wasm && wasm-pack build --target web

dist: wasm
	@cd client && yarn build

dist-dev: wasm
	@cd client && yarn build:dev

module:
	@cd module && yarn build

setup: wasm module
	@cd client && yarn install && npx playwright install
	@cd module && yarn install
	@cd snap/rpc && yarn install
	@cd snap/ui && yarn install

build:
	@cd server && cargo build

release: dist
	@cd server && cargo build --release

server: dist
	@cd server && cargo run

client:
	@cd client && yarn start

test-server: dist-dev
	@cd server && cargo run

test:
	@cd client && yarn test

test-headed:
	@cd client && yarn test-headed

lint:
	@cd client && yarn lint

fmt: lint
	@cd client && yarn prettier
	@cd library && cargo fmt
	@cd server && cargo fmt
	@cd wasm && cargo fmt

.PHONY: wasm dist dist-dev module setup build release server client test lint fmt
