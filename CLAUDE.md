# SmartLaw Desktop

Legal practice management for a Brazilian law firm. Tauri + React desktop client,
Hono/Node API, PostgreSQL. npm workspaces + Turborepo.

## Layout

| Path | What |
|---|---|
| `apps/desktop` | Tauri v2 shell + React 19, TanStack Router (file-based) and Query, Tailwind v4, shadcn/ui |
| `apps/server` | Hono API, Drizzle ORM, JWT auth |
| `packages/shared` | Zod schemas and TypeScript types shared by both |
| `scripts` | Seed and migration helpers |

The client calls the API through **Hono's typed RPC client** (`hc<AppType>`), so
`apps/server/src/routes/index.ts` exports the type the frontend consumes. Adding
a route makes it appear on `api.*` automatically — do not hand-write fetch calls.

## Commands

```bash
./dev.sh                  # Docker Postgres + API + desktop app
./dev.sh --remote         # desktop only, against the Proxmox API
./dev.sh --no-desktop     # Postgres + API only

npm run lint              # ESLint, all workspaces
npm run typecheck         # tsc --noEmit, all workspaces (via turbo)
npm run format            # Prettier

npm run db:generate -w apps/server   # generate a migration after editing schema.ts
npm run db:migrate  -w apps/server   # apply migrations
```

Both `lint` and `typecheck` run in CI on every PR (`.github/workflows/ci.yml`).

## Non-obvious things

**Multi-tenancy is manual.** Every business table has `firm_id`, and there is no
row-level security — isolation depends on every query including
`eq(table.firmId, user.firmId)`. Forgetting it leaks another firm's data. Always
scope reads *and* the `where` of updates and deletes.

**Authorization uses an allowlist.** `middleware/perfil.ts` exports
`requirePerfil(...allowed)`; profiles are `admin`, `administrativo`,
`secretaria`, `usuario`. Never write an inline denylist (`perfil !== 'x'`) — a
newly added profile would silently gain access. That mistake previously exposed
firm revenue to `secretaria`.

**The domain vocabulary is Portuguese and stays that way.** `cliente`,
`processo` (judicial / administrativo), `andamento` (case docket entry),
`honorário` (fee), `tarefa` (task), `perfil` (role), `escritório` (firm).
User-facing strings are pt-BR. Match the surrounding language in code comments.

**`routeTree.gen.ts` is generated and gitignored.** The Vite plugin writes it on
dev/build; `npm run typecheck` regenerates it first via `tsr generate`. Never
edit it, and don't be surprised when it is absent on a fresh clone.

**Datajud is the CNJ public case-tracking API.** `services/datajud/` maps a CNJ
number to the tribunal index (`cnj.ts`), talks to the API with throttle and
retry (`client.ts`), and `sincronizarProcesso` is the single idempotent path
for the "Sincronizar" button and the future batch job. Datajud stores **one
document per instance** (`grau` G1/G2/JE/TR) — never read `hits[0]` alone;
instances land in `processo_instancias`, movimentos in `andamentos` with
`tipo='DATAJUD'` and a content hash in `external_id`. Each firm may hold its
own key (`firms.datajudApiKey`), falling back to `DATAJUD_API_KEY`. **Never
return the firm key to the client**; `GET /firms/me` exposes only `hasDatajudKey`.

**The key is already stored in the database** (`firms.datajud_api_key`, both
firms, production and dev, set 2026-09-18) — it is CNJ's *published public*
key, not a secret, so no `.env` entry is needed for the feature to work. CNJ
may rotate it at any time; when searches start failing with "chave recusada",
fetch the current one from https://datajud-wiki.cnj.jus.br/api-publica/acesso
and update the column (or the Settings page). `GET /firms/datajud/status`
reports which key is in use and whether CNJ accepts it.

**DJEN (court intimações) only answers Brazilian IPs.** The production API on
LXC 103 exits through the home router's NordVPN Brazil tunnel via a VPN
Director rule; see the `hp-proxmox` skill's Router section. Research and
roadmap: `docs/INTEGRACAO_TRIBUNAIS_INSS.md`.

**Migration 0004 was reconstructed** (#31). Its unused `profiles.reset_token`
and `reset_token_expires` columns are dropped with `IF EXISTS` in 0007 because
existing databases disagreed on whether they existed; do not redeclare them.

## Conventions

- Route handlers validate input with `zValidator('json', schemaFromShared)`.
- Entity types currently live in `packages/shared/src/types.ts` and duplicate the
  Drizzle schema by hand. Prefer `typeof table.$inferSelect` for anything new —
  migrating the rest is tracked in #27.
- Server errors: log with `console.error`, return a generic message. Never log
  secrets, credentials, or full request payloads.
- Ask before adding a dependency; several were previously declared and never
  imported.
