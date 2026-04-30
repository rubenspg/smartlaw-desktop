.PHONY: dev dev-server-only stop restart rebuild rebuild-api logs logs-api logs-db db-start db-stop db-reset status help

# ── Helpers ───────────────────────────────────────────────────────────────────

DB_RUNNING := $(shell docker ps --filter "name=smartlaw-db" --filter "status=running" -q)

db-start:
	@if [ -n "$(DB_RUNNING)" ]; then \
		echo "  ✅ Postgres already running — skipping"; \
	else \
		echo "▶ Starting Postgres..."; \
		docker compose up -d postgres; \
		echo "  ✅ Postgres started"; \
	fi

# ── Main targets ──────────────────────────────────────────────────────────────

## Start full dev environment (Postgres + API + desktop)
dev: db-start
	@./dev.sh

## Start only Postgres + API (no desktop)
dev-server-only: db-start
	@./dev.sh --no-desktop

## Stop all running services (containers + any lingering node processes on 3001)
stop:
	@echo "▶ Stopping services..."
	@docker compose stop api 2>/dev/null || true
	@lsof -i :3001 -t 2>/dev/null | xargs kill -9 2>/dev/null || true
	@echo "  ✅ Done"

## Stop everything including the database
stop-all:
	@echo "▶ Stopping all services including Postgres..."
	@docker compose down
	@lsof -i :3001 -t 2>/dev/null | xargs kill -9 2>/dev/null || true
	@echo "  ✅ Done"

## Restart API only (leaves DB running)
restart: stop
	@./dev.sh --no-desktop

## Rebuild and restart API docker image (leaves DB running)
rebuild-api:
	@echo "▶ Rebuilding API image..."
	@docker compose build api
	@docker compose up -d api
	@echo "  ✅ API rebuilt and started"

## Full rebuild: stop everything, rebuild, start fresh (DB preserved)
rebuild: stop db-start
	@npm install
	@./dev.sh

# ── Database ──────────────────────────────────────────────────────────────────

## Access Postgres shell inside docker
db-shell:
	@docker exec -it smartlaw-db psql -U smartlaw -d smartlaw

## Import the smartlaw_backup.sql file into the running database
db-import:
	@echo "▶ Importing smartlaw_backup.sql into smartlaw-db..."
	@cat smartlaw_backup.sql | docker exec -i smartlaw-db psql -U smartlaw -d smartlaw
	@echo "  ✅ Import complete"

## Stop only the database container
db-stop:
	@docker compose stop postgres

## Drop and recreate DB volume (WARNING: destroys all data)
db-reset:
	@echo "WARNING: This will destroy all local DB data. Press Ctrl+C to cancel, Enter to continue."
	@read _
	@docker compose down -v
	@docker compose up -d postgres
	@echo "  ✅ DB reset"

# ── Observability ─────────────────────────────────────────────────────────────

## Follow logs for all docker services
logs:
	@docker compose logs -f

## Follow API logs only
logs-api:
	@docker compose logs -f api

## Follow DB logs only
logs-db:
	@docker compose logs -f postgres

## Show running containers status
status:
	@docker compose ps

# ── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "SmartLaw dev commands:"
	@echo ""
	@echo "  make dev                 Start full dev env (Postgres + API + desktop)"
	@echo "  make dev-server-only     Start Postgres + API only (no desktop)"
	@echo "  make stop                Stop API and kill port 3001 (DB stays up)"
	@echo "  make stop-all            Stop everything including Postgres"
	@echo "  make restart             Stop API then restart it"
	@echo "  make rebuild             npm install + restart everything (DB stays up)"
	@echo "  make rebuild-api         Rebuild API docker image only"
	@echo "  make db-start            Start Postgres if not already running"
	@echo "  make db-stop             Stop Postgres"
	@echo "  make db-shell            Open Postgres shell inside container"
	@echo "  make db-import           Import smartlaw_backup.sql into DB"
	@echo "  make db-reset            Destroy DB volume and recreate (destructive!)"
	@echo "  make logs                Follow all docker logs"
	@echo "  make logs-api            Follow API logs"
	@echo "  make logs-db             Follow DB logs"
	@echo "  make status              Show docker compose service status"
	@echo ""

.DEFAULT_GOAL := help
