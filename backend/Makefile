.PHONY: tidy test run seed up down build

export GOPROXY ?= https://goproxy.io,direct
export GOSUMDB ?= off

tidy:
	go mod tidy

test:
	go test ./...

build:
	go build -o bin/api ./cmd/api

run:
	SEED_ON_START=true MONGO_URI=$${MONGO_URI:-mongodb://localhost:27017} go run ./cmd/api

seed:
	MONGO_URI=$${MONGO_URI:-mongodb://localhost:27017} go run ./scripts/seed

up:
	docker compose up --build -d

down:
	docker compose down

# Local smoke: mongo via compose + binary on :8080
smoke-mongo:
	docker compose up -d mongo
