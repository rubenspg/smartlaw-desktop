#!/usr/bin/env bash
# Start only the SmartLaw desktop app pointing to the remote Proxmox API.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure we use the remote API running on Proxmox
export VITE_API_URL="https://smartlaw-api.rubenspg.com"

echo "▶ Starting desktop app pointing to $VITE_API_URL..."
echo "  (Local Postgres and API server are NOT started)"

# Start the desktop app
npm run dev:desktop --prefix "$ROOT_DIR"
