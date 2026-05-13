# SmartLaw Desktop

Desktop version of SmartLaw — a Tauri + React frontend backed by a Hono/Node.js API and PostgreSQL.



## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) (for local PostgreSQL)
- [Rust](https://www.rust-lang.org/tools/install) + [Tauri prerequisites](https://tauri.app/start/prerequisites/) (for the desktop app binary)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the desktop app pointing to the remote Proxmox API
./dev.sh
```

*(Note: Local Postgres and API server are no longer started by default in development. The app points to `https://smartlaw-api.rubenspg.com`.)*

---

## Environment configuration

### `apps/server/.env` — API server

| Variable | Description | Local default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://smartlaw:smartlaw-pass@localhost:5432/smartlaw` |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) | *(must set)* |
| `DATAJUD_API_KEY` | CNJ Datajud API key | *(optional in dev)* |
| `API_URL` | Base URL the server listens on | `http://localhost:3001` |
| `NODE_ENV` | `development` or `production` | `development` |
| `CSV_DATA_DIR` | Absolute path to CSV lookup data for `db:seed` | Resolved from relative path |

### `apps/desktop/.env` — Frontend (Vite)

| Variable | Description |
|---|---|
| `VITE_API_URL` | API base URL the desktop app calls |

---

## Development modes

### Local database (Docker)

Point everything at a local Postgres container:

**`apps/server/.env`:**
```env
DATABASE_URL=postgresql://smartlaw:smartlaw-pass@localhost:5432/smartlaw
API_URL=http://localhost:3001
JWT_SECRET=change-me-at-least-32-chars-long-secret
```

**`apps/desktop/.env`:**
```env
VITE_API_URL=http://localhost:3001
```

Then start:
```bash
./dev.sh
```

### Main database (HP G6 — 192.168.50.127)

Point the server and desktop at the office server. The HP G6 runs Postgres and the API in Docker.

**`apps/server/.env`:**
```env
DATABASE_URL=postgresql://smartlaw:smartlaw-pass@192.168.50.127:5432/smartlaw
API_URL=http://192.168.50.127:3001
JWT_SECRET=<same secret as the HP G6 server>
```

**`apps/desktop/.env`:**
```env
VITE_API_URL=http://192.168.50.127:3001
```

Then start only the desktop (the API is already running on the HP G6):
```bash
npm run dev:desktop
# or to also run a local API that connects to the remote DB:
npm run dev:server-only  # starts Postgres locally too — likely not what you want
```

To run just the desktop Tauri dev window without starting anything else:
```bash
npm run dev:desktop
```

---

## `dev.sh` — orchestrated dev environment

`dev.sh` starts the full stack in one command and tears it down cleanly on `Ctrl+C`.

```bash
./dev.sh [--no-desktop]
```

**What it does:**
1. Starts the PostgreSQL Docker container (`docker compose up -d postgres`)
2. Stops any running API container to free port 3001
3. Kills any process already occupying port 3001
4. Starts the API server (`npm run dev:server`) in the background and waits until `/health` responds
5. Starts the Tauri desktop app (`npm run dev:desktop`) — unless `--no-desktop` is passed
6. On exit (`Ctrl+C` or SIGTERM), kills both background processes

**Available flags:**

| Flag | Effect |
|---|---|
| *(none)* | Start Postgres + API + desktop Tauri window |
| `--no-desktop` | Start Postgres + API only (no Tauri window) |

**npm aliases:**

| Command | Equivalent |
|---|---|
| `npm run dev` | `./dev.sh` |
| `npm run dev:server-only` | `./dev.sh --no-desktop` |
| `npm run dev:server` | Start API server only (Postgres must already be running) |
| `npm run dev:desktop` | Start desktop app only (API must already be running) |

---

## Database

### Run migrations

```bash
# From repo root
npm run db:migrate --prefix apps/server

# Or from inside apps/server
npm run db:migrate
```

### Seed lookup data

```bash
npm run db:seed --prefix apps/server
```

The seed script reads CSV files from the path set in `CSV_DATA_DIR` (or the default relative path). It creates the default firm and an admin user (`admin@smartlaw.local` / `changeme`).

### Generate a new migration after schema changes

```bash
npm run db:generate --prefix apps/server
```

This computes the diff against the last migration snapshot and writes a new `.sql` file under `apps/server/src/db/migrations/`.

### Connect manually

```bash
docker exec -it smartlaw-db psql -U smartlaw -d smartlaw
```

---

## Building the desktop binary

The binary is built with Tauri and bundles the frontend + Rust shell into a native app installer.

### Prerequisites

- Rust toolchain installed (`rustup`)
- Platform build tools:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: Visual Studio C++ build tools + WebView2
  - **Linux**: `libwebkit2gtk`, `libssl`, `build-essential` (see [Tauri Linux deps](https://tauri.app/start/prerequisites/))

### Build steps

```bash
# 1. Set the production API URL
echo "VITE_API_URL=https://smartlaw-api.rubenspg.com" > apps/desktop/.env.production

# 2. Build
npm run build:desktop
```

Output files are placed in `apps/desktop/src-tauri/target/release/bundle/`:
- **macOS**: `.dmg` and `.app` inside `macos/` and `dmg/`
- **Windows**: `.msi` installer inside `msi/`
- **Linux**: `.deb` / `.AppImage` inside `deb/` and `appimage/`

Distribute the appropriate installer to users. The app will call `VITE_API_URL` (baked in at build time).

### Building for a specific platform

Tauri can only build natively for the current OS. To build for Windows from macOS (or vice versa), use a CI pipeline (e.g., GitHub Actions with `tauri-action`).

---

## Deployment (Cloudflare Tunnel — HP G6)

The HP G6 server (LXC in Proxmox) runs the API + Postgres in Docker and exposes them via a Cloudflare Tunnel at `smartlaw-api.rubenspg.com`.

### Server setup (one-time)

```bash
# Install cloudflared
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Authenticate and create tunnel
cloudflared tunnel login
cloudflared tunnel create smartlaw-tunnel
cloudflared tunnel route dns smartlaw-tunnel smartlaw-api.rubenspg.com

# Run tunnel (routes :443 → localhost:3001)
cloudflared tunnel run --url http://localhost:3001 smartlaw-tunnel
```

### Start the stack on the HP G6

```bash
# From the smartlaw-desktop directory on the HP G6
docker compose up -d
```

This starts both `postgres` and `api` containers as defined in `docker-compose.yml`.

---

## Migrating data from Supabase

```bash
# Preview only (no writes)
npm run migrate:dry-run

# Full migration
npm run migrate
```

**Options:**

| Flag | Description |
|---|---|
| `--dry-run` | Print steps without writing anything |
| `--skip-seed` | Skip `db:migrate` + `db:seed` (target already prepared) |
| `--skip-profiles` | Skip the profiles migration step |
| `--skip-dump` | Skip `pg_dump` + `psql` apply |

Requires Supabase running locally (`supabase start` in the Supabase project directory).

---

## Project structure

```
apps/
  desktop/          # Tauri + React frontend
    src/            # React app (TanStack Router + Query)
    src-tauri/      # Rust shell + tauri.conf.json
  server/           # Hono/Node.js REST API
    src/
      db/           # Drizzle schema, migrations, seed
      routes/       # API route handlers
      services/     # DatajudService, ComparisonService
      middleware/   # Auth middleware
packages/
  shared/           # Shared Zod schemas and TypeScript types
scripts/            # Migration utilities
docker-compose.yml  # Postgres + API containers
dev.sh              # One-command dev environment launcher
```
