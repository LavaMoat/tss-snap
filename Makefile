wasm:
	@cd wasm && wasm-pack build --target web

dist: wasm
	@cd client && yarn build

dist-dev: wasm
	@cd client && yarn build:dev

setup: wasm
	@cd client && yarn install && npx playwright install

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

fmt:
	@cd client && yarn prettier
	@cd server && cargo fmt
	@cd common && cargo fmt
	@cd wasm && cargo fmt

.PHONY: wasm dist dist-dev setup build release server client test fmt
