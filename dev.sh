#!/usr/bin/env bash
# Start the full SmartLaw development environment.
#
# Usage:
#   ./dev.sh            — start Postgres + API server + desktop app
#   ./dev.sh --no-desktop  — start only Postgres + API server

set -euo pipefail

NO_DESKTOP=false
for arg in "$@"; do
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
