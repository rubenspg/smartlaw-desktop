# Migration Plan: Supabase → PostgreSQL (smartlaw-desktop)

Migrate live data from the Supabase local Docker instance (`smartlaw` repo) to the self-hosted
PostgreSQL 16 instance in `smartlaw-desktop`.

---

## Connection Strings

| | Host | Port | User | Password | DB |
|---|---|---|---|---|---|
| **Source** (Supabase) | `localhost` | `54322` | `postgres` | `postgres` | `postgres` |
| **Target** (Desktop) | `localhost` | `5432` | `smartlaw` | `smartlaw-pass` | `smartlaw` |

Source URL: `postgresql://postgres:postgres@localhost:54322/postgres`  
Target URL: `postgresql://smartlaw:smartlaw-pass@localhost:5432/smartlaw`

---

## Why This Migration Is Non-Trivial

### 1. `profiles` has no `email` or `password_hash`

Supabase Auth owns user credentials. The `profiles` table only stores `id` (UUID from `auth.users`),
`nome`, `perfil`, `ativo`, `firm_id`. To migrate, you must JOIN `auth.users` (in Supabase's `auth`
schema) to get the email, then insert a placeholder bcrypt hash. **Users will need to reset their
passwords on first login.**

### 2. `GENERATED ALWAYS AS IDENTITY` rejects explicit ID inserts

The target schema uses `GENERATED ALWAYS AS IDENTITY` instead of `bigserial`. A plain `INSERT` with
an explicit `id` will fail with:

```
ERROR: cannot insert a non-DEFAULT value into column "id"
DETAIL: Column "id" is an identity column defined as GENERATED ALWAYS.
```

Fix: use `SET session_replication_role = 'replica'` before the import to bypass this check, then
reset all sequences afterward.

---

## Schema Differences (Source vs Target)

| Table | Difference |
|---|---|
| `profiles` | Target adds `email` (NOT NULL UNIQUE) and `password_hash` (NOT NULL) — must JOIN `auth.users` |
| `andamentos` | `usuario_id` FK points to `auth.users` in source, `profiles.id` in target — same UUIDs, no rewrite needed if UUIDs are preserved |
| `tarefas` | Same `usuario_id` FK difference as `andamentos` |
| `clientes_notas` | Same `usuario_id` FK difference |
| All bigint tables | Source uses `bigserial`, target uses `GENERATED ALWAYS AS IDENTITY` — same values, different insertion syntax |

All other columns are structurally identical. No data transformation needed beyond the above.

---

## Tables NOT Migrated

| Table | Reason |
|---|---|
| `audit_logs` | Source `user_id` references `auth.users`; target references `profiles.id`. Historical audit data is not worth the complexity — start fresh. |
| Lookup tables (`municipios`, `especies_processo`, `tipos_acao`, `ritos_processuais`, `localizacoes_processo`, `posicoes_parte`) | Already handled by `npm run db:seed` which reads the CSV files directly. |

---

## Migration Order (dependency order)

1. `firms`
2. `profiles`
3. `clientes`
4. `processos_judiciais`
5. `processos_administrativos`
6. `andamentos`
7. `partes`
8. `honorarios`
9. `tarefas`
10. `clientes_notas`

---

## Step-by-Step Execution

### Step 0 — Start both databases

```bash
# Source: start Supabase local
cd /Users/rubens/Workspace/smartlaw
supabase start

# Target: start desktop Postgres
cd /Users/rubens/Workspace/smartlaw-desktop
docker compose up -d
```

### Step 1 — Prepare the target database

```bash
cd /Users/rubens/Workspace/smartlaw-desktop
npm run --prefix apps/server db:migrate
npm run --prefix apps/server db:seed   # seeds all lookup tables + default admin
```

### Step 2 — Preserve the original `firm_id` UUID

The `db:seed` creates a new UUID for the firm. All rows in the source carry the original UUID. Replace
the seeded firm with the source firm before importing any data:

```bash
# Get the firm UUID from source
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -c "SELECT id, nome FROM firms;"
```

```sql
-- On target: replace seeded firm with the original UUID
-- (replace 'ORIGINAL-UUID-HERE' with the value from above)
DELETE FROM profiles;   -- seed admin depends on firm; remove first
DELETE FROM firms;
INSERT INTO firms (id, nome, created_at)
VALUES ('ORIGINAL-UUID-HERE', 'Escritório SmartLaw', now());
```

### Step 3 — Migrate `profiles` (TypeScript script)

The `profiles` table requires a JOIN against Supabase's `auth.users` schema. Run this script from
the `smartlaw-desktop` root:

```bash
cd /Users/rubens/Workspace/smartlaw-desktop
npx tsx scripts/migrate-profiles.ts
```

Script source — `scripts/migrate-profiles.ts`:

```typescript
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

const source = postgres('postgresql://postgres:postgres@localhost:54322/postgres')
const target = postgres('postgresql://smartlaw:smartlaw-pass@localhost:5432/smartlaw')

const PLACEHOLDER_HASH = await bcrypt.hash('RESET_REQUIRED', 10)

const profiles = await source`
  SELECT p.id, p.nome, u.email, p.perfil, p.ativo, p.firm_id,
         p.created_at, p.updated_at
  FROM   profiles p
  JOIN   auth.users u ON u.id = p.id
`

for (const p of profiles) {
  await target`
    INSERT INTO profiles
      (id, nome, email, password_hash, perfil, ativo, firm_id, created_at, updated_at)
    VALUES
      (${p.id}, ${p.nome}, ${p.email}, ${PLACEHOLDER_HASH},
       ${p.perfil}, ${p.ativo}, ${p.firm_id}, ${p.created_at}, ${p.updated_at})
    ON CONFLICT (id) DO NOTHING
  `
}

console.log(`✅ Migrated ${profiles.length} profiles`)
await source.end()
await target.end()
```

All original UUIDs are preserved so that `andamentos.usuario_id`, `tarefas.usuario_id`, and
`clientes_notas.usuario_id` resolve correctly without any rewrite.

### Step 4 — Dump main data from Supabase

```bash
pg_dump \
  "postgresql://postgres:postgres@localhost:54322/postgres" \
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
  -f /tmp/smartlaw_data_dump.sql
```

`--column-inserts` is required so the patched SQL can be applied to the target with identity override.

### Step 5 — Patch the dump for identity columns

```bash
cat > /tmp/smartlaw_patched.sql << 'HEADER'
-- Disable FK checks and identity enforcement during import
SET session_replication_role = 'replica';
HEADER

cat /tmp/smartlaw_data_dump.sql >> /tmp/smartlaw_patched.sql

cat >> /tmp/smartlaw_patched.sql << 'FOOTER'

-- Re-enable FK checks
SET session_replication_role = 'DEFAULT';

-- Reset all identity sequences after explicit ID inserts
SELECT setval(pg_get_serial_sequence('clientes',                  'id'), COALESCE(MAX(id), 1)) FROM clientes;
SELECT setval(pg_get_serial_sequence('processos_judiciais',       'id'), COALESCE(MAX(id), 1)) FROM processos_judiciais;
SELECT setval(pg_get_serial_sequence('processos_administrativos', 'id'), COALESCE(MAX(id), 1)) FROM processos_administrativos;
SELECT setval(pg_get_serial_sequence('andamentos',                'id'), COALESCE(MAX(id), 1)) FROM andamentos;
SELECT setval(pg_get_serial_sequence('partes',                    'id'), COALESCE(MAX(id), 1)) FROM partes;
SELECT setval(pg_get_serial_sequence('honorarios',                'id'), COALESCE(MAX(id), 1)) FROM honorarios;
SELECT setval(pg_get_serial_sequence('tarefas',                   'id'), COALESCE(MAX(id), 1)) FROM tarefas;
SELECT setval(pg_get_serial_sequence('clientes_notas',            'id'), COALESCE(MAX(id), 1)) FROM clientes_notas;
FOOTER
```

### Step 6 — Apply the dump to the target

```bash
psql "postgresql://smartlaw:smartlaw-pass@localhost:5432/smartlaw" \
  -f /tmp/smartlaw_patched.sql
```

### Step 7 — Verify row counts

Run the following query on **both** databases and compare results. All counts must match.

```sql
SELECT 'firms'                      AS table_name, COUNT(*) AS rows FROM firms
UNION ALL SELECT 'profiles',                       COUNT(*) FROM profiles
UNION ALL SELECT 'clientes',                       COUNT(*) FROM clientes
UNION ALL SELECT 'processos_judiciais',            COUNT(*) FROM processos_judiciais
UNION ALL SELECT 'processos_administrativos',      COUNT(*) FROM processos_administrativos
UNION ALL SELECT 'andamentos',                     COUNT(*) FROM andamentos
UNION ALL SELECT 'partes',                         COUNT(*) FROM partes
UNION ALL SELECT 'honorarios',                     COUNT(*) FROM honorarios
UNION ALL SELECT 'tarefas',                        COUNT(*) FROM tarefas
UNION ALL SELECT 'clientes_notas',                 COUNT(*) FROM clientes_notas
ORDER BY table_name;
```

Quick one-liner for both at once:

```bash
# Source
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c \
  "SELECT 'clientes' AS t, COUNT(*) FROM clientes UNION ALL SELECT 'processos_judiciais', COUNT(*) FROM processos_judiciais UNION ALL SELECT 'andamentos', COUNT(*) FROM andamentos;"

# Target
psql "postgresql://smartlaw:smartlaw-pass@localhost:5432/smartlaw" -c \
  "SELECT 'clientes' AS t, COUNT(*) FROM clientes UNION ALL SELECT 'processos_judiciais', COUNT(*) FROM processos_judiciais UNION ALL SELECT 'andamentos', COUNT(*) FROM andamentos;"
```

### Step 8 — First-login password reset

After migration, all user `password_hash` values are set to the bcrypt hash of `"RESET_REQUIRED"`.
Users will not be able to log in with their old passwords.

Options:
- **A (simplest):** Tell users to use the "Esqueci minha senha" flow once it is implemented.
- **B (immediate):** Temporarily set a known password for all accounts via the server's
  `POST /auth/change-password` endpoint, or directly:

```bash
# Generate a bcrypt hash for a temporary password
node -e "const b = require('bcryptjs'); b.hash('Senha@2025', 10).then(console.log)"

# Update all profiles on target
psql "postgresql://smartlaw:smartlaw-pass@localhost:5432/smartlaw" -c \
  "UPDATE profiles SET password_hash = 'HASH_FROM_ABOVE' WHERE password_hash = 'PLACEHOLDER_HASH';"
```

---

## Risk Summary

| Risk | Impact | Mitigation |
|---|---|---|
| `profiles` missing `email`/`password_hash` | Users cannot log in | JOIN `auth.users`; insert placeholder hash; force reset |
| `GENERATED ALWAYS AS IDENTITY` rejects explicit IDs | Import fails | `SET session_replication_role = 'replica'` during import |
| Sequences stuck at 1 after import | Next insert crashes with duplicate key | `setval()` reset after all rows are inserted (Step 5) |
| `firm_id` UUID mismatch | All FK references to `firm_id` are invalid | Delete seeded firm; re-insert with original UUID **before** the dump is applied |
| `usuario_id` UUID references | `andamentos`, `tarefas`, `clientes_notas` FKs break | Preserve original profile UUIDs (Step 3 keeps them) |
| No CSV for `honorarios`/`tarefas`/`clientes_notas` | These tables have no CSV export | Covered by `pg_dump` in Step 4 |
| Supabase not running | Export fails | Run `supabase start` before Step 4 |
