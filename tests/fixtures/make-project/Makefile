SHELL := /bin/bash
FMT = prettier --write
NAME ?= local

.PHONY: dev build test test-watch lint deploy db/migrate
.DEFAULT_GOAL := dev

install:
	bun install

dev: install
	node scripts/dev.mjs

build:
	@echo building
	$(FMT) .

test: build
	node --test

test-watch:
	node --test --watch

lint:
	biome check .

deploy: build
	kubectl apply -f k8s/

db/migrate:
	prisma migrate dev --name $(NAME)

bundle-%.zip: build
	zip -r $@ dist
