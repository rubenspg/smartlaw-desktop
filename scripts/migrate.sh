#!/usr/bin/env bash
# Full data migration: Supabase (local Docker) → smartlaw-desktop PostgreSQL
#
# Usage:
#   ./scripts/migrate.sh [--dry-run] [--skip-seed] [--skip-profiles] [--skip-dump]
#
# Options:
#   --dry-run        Print what would happen without writing anything
#   --skip-seed      Skip db:migrate + db:seed (target already prepared)
#   --skip-profiles  Skip the profiles migration step
#   --skip-dump      Skip pg_dump + psql apply (just profiles + verify)
#
# Requirements:
#   - pg_dump and psql must be in PATH (brew install postgresql@16 or equivalent)
#   - npx tsx must be available (installed via root node_modules)
#   - Supabase must be running: supabase start  (in /Users/rubens/Workspace/smartlaw)
#   - Desktop Postgres must be running: docker compose up -d

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE_URL="${SOURCE_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"
TARGET_URL="${TARGET_URL:-postgresql://smartlaw:smartlaw-pass@localhost:5432/smartlaw}"
PLACEHOLDER_PASSWORD="${PLACEHOLDER_PASSWORD:-RESET_REQUIRED}"
DUMP_FILE="${DUMP_FILE:-/tmp/smartlaw_data_dump.sql}"
PATCHED_FILE="${PATCHED_FILE:-/tmp/smartlaw_patched.sql}"

DRY_RUN=false
SKIP_SEED=false
SKIP_PROFILES=false
SKIP_DUMP=false

for arg in "$@"; do
  case $arg in
    --dry-run)       DRY_RUN=true ;;
    --skip-seed)     SKIP_SEED=true ;;
    --skip-profiles) SKIP_PROFILES=true ;;
    --skip-dump)     SKIP_DUMP=true ;;
  esac
done

# ─── Helpers ──────────────────────────────────────────────────────────────────

log()  { echo ""; echo "── $*"; }
ok()   { echo "   ✅ $*"; }
warn() { echo "   ⚠️  $*"; }
fail() { echo ""; echo "❌ $*" >&2; exit 1; }

psql_source() { psql "$SOURCE_URL" --no-psqlrc -q -t -A "$@"; }
psql_target() { psql "$TARGET_URL" --no-psqlrc -q -t -A "$@"; }

# ─── Preflight checks ─────────────────────────────────────────────────────────

log "Preflight checks"

command -v psql  >/dev/null 2>&1 || fail "psql not found. Install: brew install postgresql@16"
command -v docker >/dev/null 2>&1 || fail "docker not found."
ok "psql and docker found"

# pg_dump runs inside the Supabase container to avoid version mismatch
SUPABASE_CONTAINER="supabase_db_smartlaw"
docker inspect "$SUPABASE_CONTAINER" >/dev/null 2>&1 \
  || fail "Supabase container '$SUPABASE_CONTAINER' not found.\n   Start it: cd /Users/rubens/Workspace/smartlaw && supabase start"
ok "Supabase container '$SUPABASE_CONTAINER' found"

psql_source -c "SELECT 1" >/dev/null 2>&1 \
  || fail "Cannot connect to Supabase ($SOURCE_URL)\n   Start it: cd /Users/rubens/Workspace/smartlaw && supabase start"
ok "Source DB reachable (Supabase port 54322)"

psql_target -c "SELECT 1" >/dev/null 2>&1 \
  || fail "Cannot connect to target ($TARGET_URL)\n   Start it: cd $ROOT_DIR && docker compose up -d"
ok "Target DB reachable (Desktop Postgres port 5432)"

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "🔍 DRY RUN — steps will be printed but no data will be written"
fi

# ─── Step 1: Prepare target DB ────────────────────────────────────────────────

if [ "$SKIP_SEED" = false ]; then
  log "Step 1 — Prepare target DB (migrate + seed)"
  if [ "$DRY_RUN" = true ]; then
    warn "[dry-run] Would run: npm run --prefix apps/server db:migrate && db:seed"
  else
    cd "$ROOT_DIR"
    npm run --prefix apps/server db:migrate
    npm run --prefix apps/server db:seed
    ok "Migrations applied and seed data loaded"
  fi
else
  log "Step 1 — Skipped (--skip-seed)"
fi

# ─── Step 2: Preserve original firm UUID ──────────────────────────────────────

log "Step 2 — Preserve firm UUID"

SOURCE_FIRM=$(psql_source -c "SELECT id || '|' || nome FROM firms LIMIT 1")
if [ -z "$SOURCE_FIRM" ]; then
  fail "No firm found in source database. Cannot continue."
fi

SOURCE_FIRM_ID="${SOURCE_FIRM%%|*}"
SOURCE_FIRM_NOME="${SOURCE_FIRM##*|}"

TARGET_FIRM_ID=$(psql_target -c "SELECT id FROM firms LIMIT 1" 2>/dev/null || true)

if [ "$TARGET_FIRM_ID" = "$SOURCE_FIRM_ID" ]; then
  ok "Firm UUID already matches — no change needed ($SOURCE_FIRM_ID)"
else
  echo "   Source firm : $SOURCE_FIRM_ID  ($SOURCE_FIRM_NOME)"
  echo "   Target firm : ${TARGET_FIRM_ID:-<none>}"
  if [ "$DRY_RUN" = true ]; then
    warn "[dry-run] Would replace target firm with source UUID"
  else
    psql_target -c "
      DELETE FROM profiles;
      DELETE FROM firms;
      INSERT INTO firms (id, nome, created_at)
      VALUES ('$SOURCE_FIRM_ID', '$SOURCE_FIRM_NOME', now());
    " >/dev/null
    ok "Target firm replaced with source UUID ($SOURCE_FIRM_ID)"
  fi
fi

# ─── Step 3: Migrate profiles ─────────────────────────────────────────────────

if [ "$SKIP_PROFILES" = false ]; then
  log "Step 3 — Migrate profiles (JOIN auth.users for emails)"
  if [ "$DRY_RUN" = true ]; then
    SOURCE_URL="$SOURCE_URL" TARGET_URL="$TARGET_URL" PLACEHOLDER_PASSWORD="$PLACEHOLDER_PASSWORD" \
      npx tsx "$SCRIPT_DIR/migrate-profiles.ts" --dry-run
  else
    SOURCE_URL="$SOURCE_URL" TARGET_URL="$TARGET_URL" PLACEHOLDER_PASSWORD="$PLACEHOLDER_PASSWORD" \
      npx tsx "$SCRIPT_DIR/migrate-profiles.ts"
  fi
else
  log "Step 3 — Skipped (--skip-profiles)"
fi

# ─── Step 4: pg_dump main tables from Supabase ────────────────────────────────

if [ "$SKIP_DUMP" = false ]; then
  log "Step 4 — Dump main tables from Supabase"
  if [ "$DRY_RUN" = true ]; then
    warn "[dry-run] Would pg_dump to $DUMP_FILE"
  else
    # Run pg_dump inside the Supabase container to avoid client/server version mismatch
    docker exec "$SUPABASE_CONTAINER" pg_dump \
      -U postgres postgres \
      --data-only \
      --schema=public \
      --table=clientes \
      --table=processos_judiciais \
      --table=processos_administrativos \
      --table=andamentos \
      --table=partes \
      --table=honorarios \
      --table=tarefas \
      --table=clientes_notas \
      --column-inserts \
      --rows-per-insert=100 \
      --no-comments \
      > "$DUMP_FILE"
    ok "Dump written to $DUMP_FILE ($(wc -l < "$DUMP_FILE") lines)"
  fi

  # ─── Step 5: Patch dump for GENERATED ALWAYS AS IDENTITY ──────────────────

  log "Step 5 — Patch dump for identity columns"
  if [ "$DRY_RUN" = true ]; then
    warn "[dry-run] Would patch $DUMP_FILE → $PATCHED_FILE"
  else
    cat > "$PATCHED_FILE" << 'SQL_HEADER'
-- Disable FK checks and identity enforcement during import
SET session_replication_role = 'replica';

SQL_HEADER

    # Strip PG17-only settings that the target (PG16) does not recognise,
    # and inject OVERRIDING SYSTEM VALUE so explicit IDs are accepted by
    # GENERATED ALWAYS AS IDENTITY columns
    grep -v "transaction_timeout" "$DUMP_FILE" \
      | sed 's/^\(INSERT INTO public\.[^ ]* (.*)\) VALUES$/\1 OVERRIDING SYSTEM VALUE VALUES/' \
      >> "$PATCHED_FILE"

    cat >> "$PATCHED_FILE" << 'SQL_FOOTER'

-- Re-enable FK enforcement
SET session_replication_role = 'origin';

-- Reset identity sequences so the next INSERT gets the correct next value
SELECT setval(pg_get_serial_sequence('clientes',                  'id'), COALESCE(MAX(id), 1)) FROM clientes;
SELECT setval(pg_get_serial_sequence('processos_judiciais',       'id'), COALESCE(MAX(id), 1)) FROM processos_judiciais;
SELECT setval(pg_get_serial_sequence('processos_administrativos', 'id'), COALESCE(MAX(id), 1)) FROM processos_administrativos;
SELECT setval(pg_get_serial_sequence('andamentos',                'id'), COALESCE(MAX(id), 1)) FROM andamentos;
SELECT setval(pg_get_serial_sequence('partes',                    'id'), COALESCE(MAX(id), 1)) FROM partes;
SELECT setval(pg_get_serial_sequence('honorarios',                'id'), COALESCE(MAX(id), 1)) FROM honorarios;
SELECT setval(pg_get_serial_sequence('tarefas',                   'id'), COALESCE(MAX(id), 1)) FROM tarefas;
SELECT setval(pg_get_serial_sequence('clientes_notas',            'id'), COALESCE(MAX(id), 1)) FROM clientes_notas;
SQL_FOOTER

    ok "Patched file written to $PATCHED_FILE"
  fi

  # ─── Step 6: Apply dump to target ─────────────────────────────────────────

  log "Step 6 — Apply dump to target"
  if [ "$DRY_RUN" = true ]; then
    warn "[dry-run] Would apply $PATCHED_FILE to target"
  else
    psql "$TARGET_URL" --no-psqlrc -v ON_ERROR_STOP=1 -f "$PATCHED_FILE"
    ok "Dump applied to target"
  fi

else
  log "Steps 4–6 — Skipped (--skip-dump)"
fi

# ─── Step 7: Verify row counts ────────────────────────────────────────────────

log "Step 7 — Verify row counts"

VERIFY_SQL="
SELECT 'clientes'                 AS tbl, COUNT(*) FROM clientes
UNION ALL SELECT 'processos_judiciais',   COUNT(*) FROM processos_judiciais
UNION ALL SELECT 'processos_administrativos', COUNT(*) FROM processos_administrativos
UNION ALL SELECT 'andamentos',            COUNT(*) FROM andamentos
UNION ALL SELECT 'partes',                COUNT(*) FROM partes
UNION ALL SELECT 'honorarios',            COUNT(*) FROM honorarios
UNION ALL SELECT 'tarefas',               COUNT(*) FROM tarefas
UNION ALL SELECT 'clientes_notas',        COUNT(*) FROM clientes_notas
UNION ALL SELECT 'profiles',              COUNT(*) FROM profiles
ORDER BY tbl;
"

echo ""
printf "   %-30s %10s %10s %8s\n" "Table" "Source" "Target" "Match?"
printf "   %-30s %10s %10s %8s\n" "─────────────────────────────" "──────────" "──────────" "───────"

MISMATCH=0

while IFS='|' read -r tbl src_count; do
  tgt_count=$(psql_target -c "SELECT COUNT(*) FROM $tbl" 2>/dev/null || echo "ERROR")
  if [ "$tgt_count" = "$src_count" ]; then
    match="✅"
  else
    match="❌"
    MISMATCH=$((MISMATCH + 1))
  fi
  printf "   %-30s %10s %10s %8s\n" "$tbl" "$src_count" "$tgt_count" "$match"
done < <(psql_source -c "$VERIFY_SQL" 2>/dev/null)

echo ""
if [ "$MISMATCH" -eq 0 ]; then
  ok "All row counts match"
else
  warn "$MISMATCH table(s) have mismatched row counts — review the output above"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════"
if [ "$DRY_RUN" = true ]; then
  echo "  🔍 Dry run complete. No data was written."
else
  echo "  ✅ Migration complete."
  echo ""
  echo "  Next steps:"
  echo "  1. Start the API server:  npm run dev:server"
  echo "  2. Log in with any migrated email using password: $PLACEHOLDER_PASSWORD"
  echo "  3. Change all user passwords via POST /auth/change-password"
fi
echo "══════════════════════════════════════════════════════"
