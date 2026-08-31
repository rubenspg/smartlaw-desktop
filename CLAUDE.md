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

**Datajud is the CNJ public case-tracking API.** `DatajudService` maps a CNJ case
number to the right tribunal endpoint. Each firm may hold its own API key
(`firms.datajudApiKey`), falling back to `DATAJUD_API_KEY`. **That key is a
secret — never return it to the client**; `GET /firms/me` exposes only
`hasDatajudKey`.

**Migration 0004's SQL file is missing** from `apps/server/src/db/migrations`
even though its journal entry and snapshot exist, so a fresh database cannot be
bootstrapped from migrations alone. Tracked in #31. `profiles.reset_token` and
`reset_token_expires` come from it, are unused, and are declared in `schema.ts`
only so drizzle-kit does not try to drop them.

## Conventions

- Route handlers validate input with `zValidator('json', schemaFromShared)`.
- Entity types currently live in `packages/shared/src/types.ts` and duplicate the
  Drizzle schema by hand. Prefer `typeof table.$inferSelect` for anything new —
  migrating the rest is tracked in #27.
- Server errors: log with `console.error`, return a generic message. Never log
  secrets, credentials, or full request payloads.
- Ask before adding a dependency; several were previously declared and never
  imported.
