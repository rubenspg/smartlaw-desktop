# smartlaw-desktop

Desktop version of Smartlaw — a Tauri + React frontend backed by a Hono/Node.js API and PostgreSQL.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) (for PostgreSQL)
- [Rust](https://www.rust-lang.org/tools/install) + [Tauri prerequisites](https://tauri.app/start/prerequisites/) (for the desktop app)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the server env file
cp apps/server/.env.example apps/server/.env   # or create it manually (see below)
```

**`apps/server/.env`** — minimum required values:

```env
DB_PASSWORD=smartlaw-pass
JWT_SECRET=change-me-at-least-32-chars-long-secret
DATAJUD_API_KEY=your-datajud-api-key
API_URL=http://localhost:3001
DATABASE_URL=postgresql://smartlaw:smartlaw-pass@localhost:5432/smartlaw
```

**`docker-compose.yml`** reads `DB_PASSWORD` from this file (via `.env` at the project root). If you keep the default value above, copy it there too:

```bash
echo "DB_PASSWORD=smartlaw-pass" >> .env
echo "JWT_SECRET=change-me-at-least-32-chars-long-secret" >> .env
```

## Starting the development environment

### Full stack (Postgres + API + Desktop app)

```bash
npm run dev
# or directly:
./dev.sh
```

This will:
1. Start the PostgreSQL container via Docker Compose
2. Start the API server on `http://localhost:3001`
3. Build and open the Tauri desktop window

### API server only (no desktop)

```bash
npm run dev:server-only
# or:
./dev.sh --no-desktop
```

### Individual services

```bash
# Postgres only
docker compose up -d postgres

# API server only (Postgres must already be running)
npm run dev:server

# Desktop app only (API must already be running)
npm run dev:desktop
```

## Database

### Run migrations

```bash
npm run migrate
# inside apps/server:
npm run db:migrate --prefix apps/server
```

### Seed with sample data

```bash
npm run --prefix apps/server db:seed
```

### Connect manually

```bash
docker exec -it smartlaw-db psql -U smartlaw -d smartlaw
```

## Migrating data from Supabase

If you have an existing Supabase instance, use the migration script:

```bash
# Preview what would happen (no writes)
npm run migrate:dry-run

# Full migration
npm run migrate
```

**Options:**

| Flag | Description |
|------|-------------|
| `--dry-run` | Print steps without writing anything |
| `--skip-seed` | Skip db:migrate + db:seed (target already prepared) |
| `--skip-profiles` | Skip the profiles migration step |
| `--skip-dump` | Skip pg_dump + psql apply |

**Requirements:** Supabase must be running locally (`supabase start` in the Supabase project directory).

## Project structure

```
apps/
  desktop/   # Tauri + React frontend
  server/    # Hono/Node.js REST API
packages/
  shared/    # Shared types and validation (Zod)
scripts/     # Migration utilities
```
