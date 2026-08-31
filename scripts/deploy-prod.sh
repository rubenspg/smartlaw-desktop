#!/usr/bin/env bash
#
# Deploy SmartLaw to production (Proxmox LXC 103).
#
# Run this ON the production box, from the deploy directory:
#
#   ssh -i ~/.ssh/id_ed25519_homelab root@192.168.50.38 \
#     'pct exec 103 -- bash -lc "cd /root/smartlaw-desktop && ./scripts/deploy-prod.sh --yes"'
#
# Steps: preflight -> backup -> pull -> deps -> migrate -> build -> restart -> verify.
# Any failure aborts before the next step, so a broken run never leaves the API
# serving code that does not match the database.
#
# Usage:
#   ./scripts/deploy-prod.sh              interactive, prompts before migrating
#   ./scripts/deploy-prod.sh --yes        non-interactive (for automation)
#   ./scripts/deploy-prod.sh --dry-run    show what would happen, change nothing
#   ./scripts/deploy-prod.sh --skip-pull  deploy the current checkout as-is

set -euo pipefail

ASSUME_YES=false
DRY_RUN=false
SKIP_PULL=false
for arg in "$@"; do
  case "$arg" in
    --yes|-y)    ASSUME_YES=true ;;
    --dry-run)   DRY_RUN=true ;;
    --skip-pull) SKIP_PULL=true ;;
    -h|--help)   sed -n '3,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Overridable so the script can be rehearsed outside the LXC, where
# /opt/smartlaw-backups is not writable.
BACKUP_DIR="${BACKUP_DIR:-/opt/smartlaw-backups}"
DB_CONTAINER=smartlaw-db
API_CONTAINER=smartlaw-api
DB_USER=smartlaw
DB_NAME=smartlaw
NODE_IMAGE=node:20-alpine
HEALTH_URL=http://localhost:3001/health
JWT_MIN_LENGTH=32

cd "$REPO_DIR"

say()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
die()  { printf '\n\033[0;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
run()  { if $DRY_RUN; then printf '  [dry-run] %s\n' "$*"; else eval "$@"; fi; }

# The LXC host has no Node installed — everything npm/drizzle runs in a container
# with the repo bind-mounted. --network host lets it reach Postgres on localhost.
node_run() {
  docker run --rm --network host -v "$REPO_DIR:/app" -w "/app/$1" \
    -e DATABASE_URL="$DATABASE_URL" "$NODE_IMAGE" sh -c "$2"
}

# ── 1. Preflight ──────────────────────────────────────────────────────────────
say "Preflight"

command -v docker >/dev/null || die "docker not found"
docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || die "container $DB_CONTAINER is not running"
ok "docker and $DB_CONTAINER present"

[[ -f .env ]] || die ".env is missing. Production must not fall back to the compose default for JWT_SECRET (see issue #23)."

# shellcheck disable=SC1091
JWT_SECRET="$(grep -E '^JWT_SECRET=' .env | cut -d= -f2- || true)"
[[ -n "$JWT_SECRET" ]] || die "JWT_SECRET is not set in .env"
(( ${#JWT_SECRET} >= JWT_MIN_LENGTH )) \
  || die "JWT_SECRET is ${#JWT_SECRET} chars, need at least $JWT_MIN_LENGTH"
[[ "$JWT_SECRET" != "super-secret-key" ]] \
  || die "JWT_SECRET is the public default from docker-compose.yml. Rotate it before deploying."
ok "JWT_SECRET present (${#JWT_SECRET} chars, not the default)"

DB_PASSWORD="$(grep -E '^DB_PASSWORD=' .env | cut -d= -f2- || true)"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD:-smartlaw-pass}@localhost:5432/${DB_NAME}"

if ! $SKIP_PULL && [[ -n "$(git status --porcelain)" ]]; then
  git status --short
  die "Working tree is dirty. Commit, stash, or use --skip-pull."
fi
ok "working tree clean"

docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" >/dev/null 2>&1 \
  || die "Postgres is not accepting connections"
ok "database reachable"

# ── 2. Backup ─────────────────────────────────────────────────────────────────
say "Backing up the database"

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/smartlaw_deploy_$(date +%Y%m%d_%H%M%S).sql.gz"

if $DRY_RUN; then
  printf '  [dry-run] pg_dump -> %s\n' "$BACKUP_FILE"
else
  docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE" \
    || die "pg_dump failed — nothing has been changed"

  # A dump that cannot be decompressed is not a backup. Verify before migrating.
  gzip -t "$BACKUP_FILE" || die "Backup failed integrity check: $BACKUP_FILE"

  SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")
  (( SIZE > 100000 )) || die "Backup is suspiciously small (${SIZE} bytes): $BACKUP_FILE"
  ok "$BACKUP_FILE ($(numfmt --to=iec "$SIZE" 2>/dev/null || echo "$SIZE bytes"), integrity verified)"
fi

# ── 3. Code ───────────────────────────────────────────────────────────────────
if $SKIP_PULL; then
  say "Skipping git pull (--skip-pull)"
else
  say "Updating code"
  run "git fetch origin"
  run "git pull --ff-only origin main"
fi
ok "at $(git log --oneline -1)"

# ── 4. Dependencies ───────────────────────────────────────────────────────────
say "Installing dependencies"
# Needed before migrating: drizzle.config.ts imports dotenv.
run "node_run '' 'npm ci'"
ok "npm ci complete"

# ── 5. Migrations ─────────────────────────────────────────────────────────────
say "Applying database migrations"

APPLIED=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A \
  -c 'select count(*) from drizzle.__drizzle_migrations' 2>/dev/null || echo 0)
ON_DISK=$(find apps/server/src/db/migrations -maxdepth 1 -name '*.sql' | wc -l | tr -d ' ')
PENDING=$(( ON_DISK - APPLIED ))
printf '  applied: %s   on disk: %s   pending: %s\n' "$APPLIED" "$ON_DISK" "$PENDING"

if (( PENDING > 0 )) && ! $ASSUME_YES && ! $DRY_RUN; then
  read -rp "  Apply $PENDING migration(s) to PRODUCTION? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || die "Aborted by user. Backup kept at $BACKUP_FILE"
fi

# npx cannot be used here: it installs drizzle-kit into its own sandbox where it
# cannot resolve the workspace's drizzle-orm, and fails with
# "Please install latest version of drizzle-orm".
run "node_run 'apps/server' 'node node_modules/drizzle-kit/bin.cjs migrate'"
ok "migrations applied"

# ── 6. Build and restart ──────────────────────────────────────────────────────
say "Building and restarting the API"
run "docker compose build api"
run "docker compose up -d api"

# ── 7. Verify ─────────────────────────────────────────────────────────────────
say "Verifying"

if $DRY_RUN; then
  printf '  [dry-run] would poll %s\n' "$HEALTH_URL"
else
  for i in $(seq 1 30); do
    if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      ok "API healthy at $HEALTH_URL"
      break
    fi
    if (( i == 30 )); then
      printf '\n\033[0;31m✗ API did not become healthy within 60s\033[0m\n' >&2
      docker logs "$API_CONTAINER" --tail 30 >&2 || true
      cat >&2 <<EOF

To roll back:
  git -C $REPO_DIR reset --hard <previous-commit>
  gunzip -c $BACKUP_FILE | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME
  cd $REPO_DIR && docker compose build api && docker compose up -d api
EOF
      exit 1
    fi
    sleep 2
  done

  # The DB password used to be printed on every boot (issue #21). Catch a regression.
  if docker logs "$API_CONTAINER" --tail 50 2>&1 | grep -q 'DATABASE_URL is'; then
    printf '  \033[0;33m! WARNING\033[0m: the API is logging DATABASE_URL. See issue #21.\n'
  fi
fi

say "Deploy complete"
printf '  commit:  %s\n' "$(git log --oneline -1)"
printf '  backup:  %s\n' "${BACKUP_FILE:-<dry-run>}"
