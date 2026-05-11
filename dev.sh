#!/usr/bin/env bash
# Start the SmartLaw development environment.
#
# Usage:
#   ./dev.sh              — start local Postgres + API server + desktop app
#   ./dev.sh --remote     — start only desktop app pointing to remote API
#   ./dev.sh --no-desktop — start only local Postgres + API server

set -euo pipefail

REMOTE=false
NO_DESKTOP=false
for arg in "$@"; do
  [[ $arg == --remote ]] && REMOTE=true
  [[ $arg == --no-desktop ]] && NO_DESKTOP=true
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo ""
  echo "Stopping processes..."
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
  [[ -n "${DESKTOP_PID:-}" ]] && kill "$DESKTOP_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [[ $REMOTE == true ]]; then
  echo "▶ Starting desktop app pointing to REMOTE API..."
  export VITE_API_URL="https://smartlaw-api.rubenspg.com"
  npm run dev:desktop --prefix "$ROOT_DIR"
  exit 0
fi

# ── Local Stack ───────────────────────────────────────────────────────────────

# ── Postgres (Docker) ─────────────────────────────────────────────────────────
echo "▶ Starting Postgres via Docker Compose..."
docker compose up -d postgres
echo "  ✅ Postgres container ready"

# ── Stop API container (if running) to free port 3001 ─────────────────────────
echo "▶ Stopping any running API container..."
docker compose stop api 2>/dev/null || true

# ── Port Check ────────────────────────────────────────────────────────────────
echo "▶ Checking for processes on port 3001..."
if lsof -i :3001 -t >/dev/null 2>&1; then
  echo "  Found process on port 3001, killing..."
  lsof -i :3001 -t | xargs kill -9 2>/dev/null || true
fi

# ── API server ────────────────────────────────────────────────────────────────
echo "▶ Starting API server..."
npm run dev:server --prefix "$ROOT_DIR" &
SERVER_PID=$!

# Wait until /health responds
echo "▶ Waiting for API to be ready..."
until curl -sf http://localhost:3001/health >/dev/null 2>&1; do
  sleep 1
done
echo "  ✅ API server ready at http://localhost:3001"

# ── Desktop app ───────────────────────────────────────────────────────────────
if [[ $NO_DESKTOP == false ]]; then
  echo "▶ Starting desktop app..."
  npm run dev:desktop --prefix "$ROOT_DIR" &
  DESKTOP_PID=$!
  echo "  ✅ Desktop app starting (Tauri window will open shortly)"
fi

echo ""
echo "════════════════════════════════════════"
echo "  SmartLaw dev environment is running"
echo "  API  → http://localhost:3001"
echo "  Press Ctrl+C to stop everything"
echo "════════════════════════════════════════"
echo ""

wait
