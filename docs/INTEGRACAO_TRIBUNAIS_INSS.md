# Plano: integração com tribunais (Datajud, DJEN) e INSS

Written for AI agents implementing this in `smartlaw-desktop`. Every endpoint below was
probed live on **2026-09-18** with `curl` from the dev machine (US egress), from the Proxmox
host that runs the API today (US egress) and, for the geoblocked hosts, through a Brazilian VPN
exit. Re-run `scripts/probe-court-apis.sh` before implementing anything: CNJ rotates keys and
blocks change. The desktop app runs on the lawyers' computers **in Brazil**; the API server
runs in the US unless it is moved (see §5).

---

## 0. TL;DR — decisions already made by the research

| Source | Verdict | Why |
|---|---|---|
| **Datajud (CNJ public API)** | **Primary source for judicial cases. Build on it now.** | Works from the US, no signup, public key, fresh (TRF4 updated 2026-09-16, TJRS 2026-09-14, TRT4 2026-09-14), batch lookup of 50 numbers in one request, 46/50 of the firm's real TRF4 numbers found. |
| **DJEN / Comunica API (intimações)** | **Second source. Verified end-to-end from Brazil; the caller must have a Brazilian IP.** | No auth, official source of every intimação since 2025-05-16. From the US CloudFront returns `403` "blocked access from your country"; through a Brazilian VPN every query worked: the firm's two lawyers receive ~11 communications per business day (469 in 60 days, 321 cases, TRF4 + TJRS). |
| **eproc MNI SOAP (TRF4 / TJRS)** | Do not build. | TRF4 answers SOAP but refuses `consultarProcesso` to non-credentialed callers; TJRS eproc is geoblocked (403). MNI is for institutional partners, not law firms. |
| **PDPJ / Jus.br unified consultation API** | Do not build (yet). | Backend `consultaprocessual.pdpj.jus.br/api/v1/processos` requires a Keycloak token; the SPA client forbids password grant; third-party credentials come only from CNJ (`integracaopdpj@cnj.jus.br`); portal host answers `429` from the US. |
| **INSS (Meu INSS / PAT-GERID / Dataprev)** | **No public API exists. Build a document-import workflow, not an integration.** | Access is gov.br + procuração eletrônica + mandatory 2FA on the lawyer's account. Vendors that automate it (Astrea) use the client's gov.br password and break on 2FA. Prevjud/Dataprev APIs are judiciary/government only. |
| **Commercial aggregators (Judit, Escavador)** | Optional paid fallback, phase 6. | Cover eproc/PJe scraping and webhooks, priced per query/monitored item. Only worth it if Datajud+DJEN leave gaps. |

The firm's data drives priorities. From `smartlaw_backup.sql`:

| Segment | Count | Note |
|---|---|---|
| Processos judiciais | 3,733 | 1,122 in CNJ format: TRF4 664, TJRS 430, TRT4 26. The other ~2,600 use the pre-2010 TRF4 format `AAAA.71.OO.NNNNNN-D` (convertible, see §7). |
| Processos administrativos (INSS) | 3,295 | `numero` is the NB (benefit number) or protocol; `especie_id` = benefit species (B31, B41, B42…). |
| `last_sync` populated | 0 | Datajud sync has never run in production. |
| Andamentos | ~110k | `tipo` is null or `L` on legacy rows; the app writes `MANUAL`/`SISTEMA`. |

---

## 1. What exists in the codebase today

- `apps/server/src/services/DatajudService.ts` — maps a CNJ number to an alias and does one `match` query. Returns only `hits[0]._source`.
- `apps/server/src/services/ComparisonService.ts` — "drift" check: compares `orgaoJulgador`, `tribunal`, and *counts* of movimentos vs. local andamentos of tipo `DATAJUD|SISTEMA`.
- `apps/server/src/routes/processos-judiciais.ts` — `POST /processos/judiciais/datajud/search` (used by the *Novo Processo* wizard) and `POST /processos/judiciais/:id/sync` (manual button on the case page). Sync stores the raw doc in `processos_judiciais.datajud_raw`, sets `last_sync`/`sync_status`, and inserts **one** `SISTEMA` andamento saying "N novas movimentações" — it does **not** insert the movimentos themselves.
- `firms.datajud_api_key` (per firm, never returned to the client) with `DATAJUD_API_KEY` env fallback. `apps/server/.env` currently holds the placeholder `your-datajud-api-key`, which is why the feature fails locally.
- No scheduler, no notification table, no OAB number on `profiles`, no HTTP plugin in the Tauri shell (`tauri-plugin-opener` only).

### Defects to fix first (Phase 1)

1. **Only one instance is read.** Datajud stores **one document per instance** (`grau` = `G1`, `G2`, `JE`, `TR`). `_id` looks like `TRF4_G2_50192100820214047100`. For case `5019210-08.2021.4.04.7100` the G1 doc has 116 movimentos (last update 2025-08-02) and the G2 doc has 6 (last update 2026-09-07). `hits[0]` silently picks one.
2. **`movimentos` are not sorted.** The array is in arbitrary order; code uses `movimentos[0].nome` as "situação".
3. **Alias mapping errors.** `J=2` → `api_publica_cnj` does not exist (404 `index_not_found_exception`). `J=6` with `TR≠00` must map to `api_publica_tre-<uf>` (verified `api_publica_tre-rs`). `J=9` maps to `api_publica_tjmmg|tjmrs|tjmsp` (verified `api_publica_tjmrs`), not "unsupported".
4. **Drift by count is wrong** once movimentos are stored individually; replace by set difference on `externalId`.
5. Unknown `uf` code falls back to `sp` silently; must throw.

---

## 2. Verified endpoint facts (2026-09-18)

### 2.1 Datajud — `https://api-publica.datajud.cnj.jus.br/<alias>/_search`

- Auth header: `Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==` (the key CNJ publishes at `datajud-wiki.cnj.jus.br/api-publica/acesso`; CNJ says it may rotate it. Keep it in `DATAJUD_API_KEY`, and let the firm override.)
- Elasticsearch `_search` semantics: `match`, `terms`, `bool/filter/range`, `sort`, `search_after`, `track_total_hits`, `_source` filtering all work. `aggs` on text fields fail (`Fielddata is disabled`); `_mapping` is forbidden.
- Verified sizes: `size: 10000` returned 1.3 MB in 3.5 s. `hits.total` caps at 10,000 unless `track_total_hits: true`.
- Verified batch: `terms` on `numeroProcesso` with 50 numbers → 76 docs (multi-grau), 1.8 s.
- Verified throughput: 30 back-to-back requests, all `200`, ~0.6 s each. No documented rate limit; the ToS (art. 3.3/3.8) allows only legal, non-commercial, authorized use and forbids reselling the data. Be polite: ≤ 2 req/s, backoff on 429/5xx.
- Document shape (fields verified in real responses):

```json
{
  "_id": "TRF4_G2_50192100820214047100",
  "_source": {
    "id": "TRF4_1728_G2_44542_50006488520114047104",
    "tribunal": "TRF4", "grau": "G2",
    "numeroProcesso": "50006488520114047104",
    "dataAjuizamento": "20110803143540",
    "nivelSigilo": 0,
    "orgaoJulgador": { "codigo": 44542, "nome": "GAB. 54 (...)", "codigoMunicipioIBGE": 4314902 },
    "classe": { "codigo": 1728, "nome": "Apelação / Remessa Necessária" },
    "sistema": { "codigo": 4, "nome": "Projudi" },
    "formato": { "codigo": 1, "nome": "Eletrônico" },
    "assuntos": [ { "codigo": 6104, "nome": "Pensão por Morte (Art. 74/9)" } ],
    "dataHoraUltimaAtualizacao": "2021-07-23T23:17:48.618000Z",
    "@timestamp": "2021-07-23T23:17:48.618000Z",
    "movimentos": [
      { "codigo": 85, "dataHora": "2015-01-09T18:18:09.000Z", "nome": "Petição",
        "complementosTabelados": [ { "codigo": 19, "descricao": "tipo_de_peticao", "valor": 57, "nome": "Petição (outras)" } ],
        "orgaoJulgador": { "codigo": "44542", "nome": "GAB. 54 (...)" } }
    ]
  }
}
```

  Notes: `movimentos[]` have no id; two movimentos may share `codigo` and differ by one second. `dataAjuizamento` is `YYYYMMDDHHmmss`. `orgaoJulgador.codigo` is a number at top level and a string inside movimentos. Party names are **not** exposed (LGPD).
- Aliases verified with `size:0`: `trf4` (14.7M docs), `tjrs` (14.4M), `trt4` (2.0M), `tjdft`, `stj`, `tst`, `tre-rs`, `tjmrs`. Full list: `datajud-wiki.cnj.jus.br/api-publica/endpoints`.
- Incremental sync works: `range` on `dataHoraUltimaAtualizacao` + `sort: [{"@timestamp":"asc"}]` + `search_after` returned pages correctly for `orgaoJulgador.codigo = 44542` since 2026-09-01 (2,879 docs).

### 2.2 DJEN — `https://comunicaapi.pje.jus.br/api/v1/comunicacao` (verified from Brazil)

- **Geoblocked by IP country.** `403` (CloudFront) from both US hosts; `200` through a Brazilian VPN. The caller (API server, relay or desktop) must sit in Brazil. Swagger is readable from anywhere: `api.swaggerhub.com/apis/cnj/pcp/1.0.0`.
- **No auth** for `GET`. 12 back-to-back requests → all `200`; still space requests ≥ 500 ms.
- Query params (all verified): `numeroOab` + `ufOab`, `nomeAdvogado`, `nomeParte`, `numeroProcesso` (20 digits **or** masked `5019210-08.2021.4.04.7100`, both work), `siglaTribunal`, `dataDisponibilizacaoInicio` / `dataDisponibilizacaoFim` (`yyyy-mm-dd`), `pagina` (1-based), `itensPorPagina`.
- **`numeroOab` is normalized server-side.** `57689`, `057689` and `RS057689` returned the identical 575 items. Items still print the OAB inconsistently (`57689` vs `RS057689`), so normalize with `replace(/^[A-Z]+0*/, '')` when matching locally.
- **Page size**: 100, 200, 500 and 1000 all returned full pages (the "50 max" found in blogs is outdated). Use 100–200.
- **`count` is unreliable**: it was the real total with page size 50/100 (`575`, `29225`) but equal to the page size with 200+, and `10000` for one-day tribunal-wide queries. Paginate until a page comes back shorter than `itensPorPagina`. Pages are ordered newest → oldest and had no duplicates across 6 pages (575 unique ids).
- Date range: without dates the API returns everything (DJEN history starts in 2025). Same-day publications are already visible on the day of `data_disponibilizacao`. Volume in the sample was flat Mon–Fri, none on weekends.
- Response item (real shape, names redacted):

```json
{ "id": 719963645, "hash": "gdDzaKrk7RJ3Sjh3h8BaxA6bBEe3Nl",
  "data_disponibilizacao": "2026-09-08", "datadisponibilizacao": "08/09/2026",
  "siglaTribunal": "TRF4", "tipoComunicacao": "Intimação", "tipoDocumento": "Ato ordinatório",
  "nomeOrgao": "17ª Vara Federal de Porto Alegre", "idOrgao": 11306,
  "nomeClasse": "PROCEDIMENTO DO JUIZADO ESPECIAL CÍVEL", "codigoClasse": "436",
  "numero_processo": "50192100820214047100", "numeroprocessocommascara": "5019210-08.2021.4.04.7100",
  "meio": "D", "meiocompleto": "Diário de Justiça Eletrônico Nacional",
  "link": "https://eproc.trf4.jus.br/eproc2trf4/externo_controlador.php?acao=consulta_publica_documento&...",
  "texto": "<html>…full HTML of the act…</html>",
  "numeroComunicacao": 1, "ativo": true, "status": "P",
  "motivo_cancelamento": null, "data_cancelamento": null,
  "destinatarios": [ { "nome": "…", "polo": "A", "comunicacao_id": 719963645 } ],
  "destinatarioadvogados": [ { "advogado": { "id": 1, "nome": "…", "numero_oab": "RS062492", "uf_oab": "RS" } } ] }
```

  Values seen: `tipoComunicacao` ∈ Intimação (≈87%), Lista de distribuição, Ata de sessão, Pauta de julgamento, Citação, Edital; `tipoDocumento` ∈ Ato ordinatório, DESPACHO/DECISÃO, Outros, Sentença, Acórdão, Ata de sessão de julgamento, Notificação, Distribuição; `meio` ∈ `D` (DJEN) / `E` (Plataforma Nacional de Editais); `status` was always `P` and `ativo` always `true` in 1,000 items (cancellations exist in the schema: keep the columns). `texto` is HTML (median 1 KB, p95 8 KB) — strip tags and `<style>` before storing `texto_plano`; keep the raw HTML too. Eproc acts begin with a header the parser can rely on: class + number, parties, `ADVOGADO(A) : Nome (OAB RS062492)`, then the act.
- `GET /api/v1/comunicacao/{id}` → `{status, message, items:[item]}`. `GET /api/v1/comunicacao/{hash}/certidao` → `application/pdf` (61 KB) — the certidão to attach to the case file. `/api/v1/tribunal` and `/tribunais` do not exist (404).
- **Firm sizing (60 days, 2026-07-20 → 09-18)**: OAB RS 62492 → 467 items / 319 cases (TRF4 241, TJRS 224, STJ 1, TRF3 1); OAB RS 55817 → 466 / 319; both lawyers are co-addressed on 464 of them, so the union is only 469 items / 321 cases ≈ **11 per business day**. A third OAB (RS 127837) appears on 46 items. **Only 58 of the 321 cases exist in `smartlaw_backup.sql`** (April 2026 dump): 263 are unregistered, 214 of them filed in 2026 — the office is not registering new cases, or the dump is stale. Either way Phase 3 must handle "intimação for an unknown case" as the normal path, not the exception.
- Legal weight: since 2025-05-16 (Res. CNJ 455/2022 + 569/2024) **all** prazos count from DJEN/DJE publication, so this is the authoritative feed for TRF4, TJRS and TRT4 alike.
### 2.3 Others (negative results, keep for the record)

| Endpoint | Result |
|---|---|
| `eproc.trf4.jus.br/eproc2trf4/ws/controlador_ws.php?srv=intercomunicacao2.2` | `200` with empty body for `?wsdl`; SOAP `consultarProcesso` → `500` fault "Procedure 'consultarProcesso' not present". Institutional-only. |
| `eproc1g.tjrs.jus.br`, `eproc2g.tjrs.jus.br` | `403` from the US; `302` (login) from Brazil. MNI WSDL from Brazil: `200` with empty body, same as TRF4 — institutional-only. |
| `pje.trt4.jus.br/primeirograu/intercomunicacao?wsdl` | `404`. Only 26 TRT4 cases; Datajud + DJEN cover them. |
| `consultaprocessual.pdpj.jus.br/api/v1/processos` | `401` without token. Keycloak realm `pje` at `sso.cloud.pje.jus.br`; client `consultaprocessual-frontend` → "Client not allowed for direct access grants". |
| `portaldeservicos.pdpj.jus.br` | `429` from the US, `403` from Brazil — a WAF/auth rule, not geoblocking. Not usable without CNJ credentials. |
| `www.cnj.jus.br/sgt/sgt_ws.php?wsdl` | `200`, 7.6 KB WSDL. Tabelas Processuais Unificadas (movimento/classe/assunto codes) — optional enrichment. |
| `meu.inss.gov.br`, `gov.br/conecta` | Reachable but no API for third parties. |

---

## 3. Target architecture

```
                 ┌────────────────────────────┐
  Datajud (US ok)│ apps/server                 │
  ──────────────▶│  services/datajud/*         │──┐
                 │  services/djen/*  ──────────┼──┼──▶ BR relay ──▶ comunicaapi.pje.jus.br
                 │  jobs/scheduler.ts          │  │
                 └──────────┬─────────────────┘  │
                            ▼                    │
   processos_judiciais.instancias (new)          │
   andamentos (tipo DATAJUD, external_id)  ◀─────┘
   intimacoes (new)  ──▶ tarefas (prazo)  ──▶ notificacoes (new) ──▶ Hub + ntfy (optional)
```

Principles:

- **Pull, normalize, store, diff.** Never show remote data live; always write to Postgres and let the UI read local tables (the desktop is typed against the routes via `hc<AppType>`).
- **Idempotent upserts keyed by `external_id`.** Datajud movimento key: `sha1(docId|codigo|dataHora|nome|JSON(complementosTabelados))`. DJEN key: `djen:<id>`.
- **Everything scoped by `firm_id`**, including the new tables and every job query.
- **One scheduler in the API process** (`setInterval` + advisory lock `pg_advisory_xact_lock`) — no new infra. The API already runs 24/7 on LXC 103.
- **Geoblocked hosts go through a relay** (§5). The relay is a config value (`BR_RELAY_URL`), so local dev without a relay simply skips DJEN.

---

## 4. Phased plan (each phase is one PR-sized unit for an agent)

**Model allocation (decided 2026-09-18):** Fable implements Phase 1 (Datajud core + fixtures + tests) and the Phase 3 domain logic (prazo/business-day rules, OAB dedupe, `TRIAGEM` auto-create, `DjenClient` + transport). Opus implements everything else — Phase 2, Phase 4, the gluetun/relay/deploy hook, all desktop UI, Phase 5, Phase 6 — building on Phase 1's merged code, not on this document alone. Every Opus PR gets a `/code-review` pass with two explicit checks: every query scoped by `firm_id`, and authorization via `requirePerfil(...)` allowlists only.


### Phase 1 — Make Datajud correct (no schema change except one table)

**Status: implemented on branch `feat/datajud-instancias` (2026-09-18, Fable).** Code: `apps/server/src/services/datajud/{cnj,client,normalizar,sincronizar}.ts`, migration `0007_processo_instancias`, routes `POST /processos/judiciais/datajud/search`, `POST /processos/judiciais/:id/sync`, `GET /firms/datajud/status`; desktop wizard, case page (instances card, per-instance badges) and Settings status panel. Tests: 47 unit (`*.test.ts` next to the code, fixtures in `apps/server/test/fixtures/datajud/`) + 5 integration (`sincronizar.itest.ts`). Verified live against Datajud: `5019210-08.2021.4.04.7100` → 2 instances, 119 distinct andamentos (the G1 document carries 3 exact duplicate movimentos, merged on purpose), second sync inserts 0. Phase 2 should call `aplicarInstancias()` with the hits from `DatajudClient.buscarVarios()` — do not re-implement the upsert.


Files: `apps/server/src/services/DatajudService.ts`, `ComparisonService.ts`, `routes/processos-judiciais.ts`, `packages/shared/src/types.ts`, `apps/desktop/src/routes/_dashboard/processos/novo.tsx`, `$id.tsx`.

1. Rewrite `DatajudService`:
   - `aliasFor(numeroCnj)` with the corrected table (§8). Throw on unknown codes; never default.
   - `fetchByNumero(numero, key)` → returns **all** docs (`size: 10`), sorted by `grau` order `G1 < JE < TR < G2 < G3`, each with `movimentos` sorted by `dataHora` desc.
   - `fetchMany(alias, numeros[], key)` → `terms` query, `size: numeros.length * 4`, `_source` limited to the fields we store.
   - `searchUpdatedSince(alias, sinceIso, orgaoCodigo?)` → `search_after` paginator (`sort: @timestamp asc`, `size: 1000`).
   - Shared `datajudRequest()` with timeout (15 s), retry with backoff on 429/5xx, and a token-bucket (2 req/s per process).
2. New table `processo_instancias` (`processo_judicial_id`, `firm_id`, `datajud_doc_id` unique, `grau`, `tribunal`, `classe_codigo/nome`, `orgao_julgador_codigo/nome`, `sistema`, `formato`, `nivel_sigilo`, `assuntos jsonb`, `data_ajuizamento`, `data_hora_ultima_atualizacao`, `raw jsonb`, `synced_at`). Keep `processos_judiciais.datajud_raw` for now but stop writing it.
3. Sync writes movimentos as `andamentos` rows: `tipo='DATAJUD'`, `data=dataHora`, `inclusao=now()`, `historico="<nome> — <complementos>"`, `documento=<grau>`, `external_id` as above, `usuario_id=null`. `ON CONFLICT (external_id) DO NOTHING`. Return `{ novos: n, instancias: [...] }`.
4. `situacao` heuristic: last movimento of the highest grau; codes `22` (Baixa Definitiva), `848` (Trânsito em julgado), `246` (Arquivamento) → `ARQUIVADO`; else `ATIVO`. Only fill when local is empty/`N/A` (keep current behaviour).
5. `ComparisonService.checkDrift`: diff `orgaoJulgador`/`classe` per instance; `newMovements` = count of inserted rows.
6. Fix `.env`: put the public key in `DATAJUD_API_KEY` (dev) and in the production `.env` on LXC 103. Add a `GET /firms/datajud/status` that runs a `size:0` query and reports `ok|invalid_key|unreachable` for the Settings page.
7. UI: case page shows instances as tabs (G1/JE/TR/G2) with their movimentos; sync button shows "N novos andamentos". Wizard (`novo.tsx`) fills `distribuicao` from `dataAjuizamento` (parse `YYYYMMDDHHmmss`), `justica` from `tribunal`, `orgaoJulgador` from the **lowest** grau, `comarca` from `codigoMunicipioIBGE` via `municipios.cod_ibge`.
8. Tests (vitest): alias mapping table, movimento key stability, sort order, `dataAjuizamento` parse, drift on fixtures captured from the real responses above (store fixtures under `apps/server/test/fixtures/datajud/`).

Acceptance (met): `POST /processos/judiciais/:id/sync` on `5019210-08.2021.4.04.7100` yields two instances and 119 distinct andamentos; second run yields 0 new.

### Phase 2 — Scheduled bulk sync + in-app notifications

Files: new `apps/server/src/jobs/scheduler.ts`, `jobs/datajud-sync.ts`, migration `0007_*`, `routes/notificacoes.ts`, desktop Hub card.

1. Table `notificacoes` (`id`, `firm_id`, `usuario_id` nullable = broadcast, `tipo` `ANDAMENTO|INTIMACAO|SYNC_ERRO`, `titulo`, `corpo`, `processo_judicial_id`, `processo_admin_id`, `intimacao_id`, `lida_em`, `created_at`) + index `(firm_id, lida_em, created_at)`.
2. ~~Table `sync_runs`~~ — **already created by Phase 3's migration 0008** (`tipo DJEN|DATAJUD`, `status EXECUTANDO|SUCESSO|GEOBLOQUEADO|ERRO`, `janela_inicio/fim`, `itens_lidos/novos`, `processos_criados`, `tarefas_criadas`, `mensagem`, `detalhes jsonb`); write the Datajud job's rows into it with `tipo='DATAJUD'`. Original: table `sync_runs` (`id`, `firm_id`, `fonte` `DATAJUD|DJEN`, `started_at`, `finished_at`, `status`, `processos_verificados`, `novos_andamentos`, `erro`) for the Settings page and for debugging.
3. Job `datajud-sync` (default every 6 h, configurable `DATAJUD_SYNC_CRON`): for each firm → group active cases (`dt_arquivado is null`) by alias → chunks of 50 numbers → `fetchMany` → upsert instances/movimentos → for each case with new rows create one `notificacoes` row (`ANDAMENTO`, "3 novos andamentos em 5019210-08…"). Skip cases whose instance `dataHoraUltimaAtualizacao` did not change (cheap: compare before parsing movimentos).
4. Budget check: 1,122 CNJ numbers / 50 = 23 requests per run; with the converted legacy numbers (§7) ~75 requests. At 2 req/s that is < 1 minute. Fine every 6 h.
5. Scheduler: `startScheduler()` called from `index.ts` only (not from `app.ts`, so tests don't run it); `SCHEDULER_ENABLED=false` to disable; wrap each run in `pg_advisory_xact_lock(hashtext('datajud-sync'))` so two API replicas never overlap.
6. Routes: `GET /notificacoes?naoLidas=1`, `PATCH /notificacoes/:id/lida`, `POST /notificacoes/lidas` (mark all). `GET /firms/sync-runs`.
7. Desktop: bell in the layout header with unread count (poll 60 s via TanStack Query), Hub card "Novidades nos processos", clicking opens the case page.
8. Optional: `NTFY_URL`/`NTFY_TOPIC` per firm (`firms.ntfy_topic`) → push the same text to ntfy (already used by dashfin). Keep it behind a feature flag; the firm may not want phone pushes.

Acceptance: after the first scheduled run, `sync_runs` shows the row, Hub shows notifications, rerun creates none.

### Phase 3 — DJEN intimações (the caller must be in Brazil, see §5)

**Status (2026-09-18): domain logic implemented by Fable — `apps/server/src/services/djen/`, migration `0008_intimacoes`, `routes/intimacoes.ts`, 47 unit + 10 integration tests on redacted real fixtures (`apps/server/test/fixtures/djen/`).** What exists and what Opus still owns:

| Done (Fable) | Where | Remaining (Opus) |
|---|---|---|
| `DjenClient` — paging that ignores `count`, 500 ms throttle, retry on 429/5xx, `403 → DjenError('geobloqueado')`, `direct`/`relay` transport, `obter`, `certidao`, `verificarAcesso` | `services/djen/client.ts` | — |
| Business-day calendar + prazo (`calcularPrazo`): publication = next business day, count from the next, national + movable holidays, recess 20/12–20/01, `firms.feriados` extras | `services/djen/prazos.ts` | Settings UI for `firms.feriados` |
| OAB normalization, dedupe by id, `textoPlano`, prazo table (`prazoSugerido`), informational types | `services/djen/normalizar.ts` | Phase 6 proposes N from the text |
| `sincronizarIntimacoes({firmId, client, datajud?, dias|inicio/fim})`: `sync_runs` row (`EXECUTANDO → SUCESSO|GEOBLOQUEADO|ERRO`), one query per OAB, upsert `(firm_id, external_id)`, link by CNJ digits (also relinks old rows when a case is registered later), **TRIAGEM auto-create** + immediate Datajud sync, **tarefa per prazo** to the profile whose OAB matched (fallback: oldest active admin) | `services/djen/sincronizar.ts` | `jobs/djen-sync.ts` calling it at 09:00 and 14:00 America/Sao_Paulo (window `dias: 3`); `notificacoes` rows from `resultado.processosEmTriagem` |
| Schema: `intimacoes` (with `prazo_dias/prazo_publicacao/prazo_fim`, `oabs_alvo`, `lida_em/lida_por`, `tarefa_id`), **`sync_runs`** (so Phase 2 reuses it — do not create it again), `profiles.oab_numero/oab_uf`, `firms.oabs_monitoradas` + `firms.feriados` (seeded for this firm in the migration) | `db/schema.ts`, `migrations/0008_intimacoes.sql` | — |
| Routes: `GET /intimacoes` (filters `lida`, `tribunal`, `inicio`, `fim`, `processoId`, paginated, no HTML), `GET /intimacoes/:id`, `POST|DELETE /intimacoes/:id/lida`, `GET /intimacoes/runs`, `GET /intimacoes/status`, `POST /intimacoes/sync {dias?, inicio?, fim?}` (admin/administrativo); `PATCH /usuarios/:id` accepts `oabNumero/oabUf`; `PATCH /firms/me` accepts `oabsMonitoradas/feriados` | `routes/intimacoes.ts`, `usuarios.ts`, `firms.ts` | Desktop: Intimações page, case-page section, Hub card, Triagem filter/badge on Processos, OAB fields in Usuários, OABs/feriados in Configurações |

Deviations from the list below, on purpose: **Citação suggests 15 business days, not 30** (CPC art. 335; 30 is the Fazenda's doubled prazo, and a suggestion longer than the law is the one error the calculator must never make); `external_id` is unique per firm, not global; `TRIAGEM` creation happens only for intimações inserted in that run (a run with `criarProcessos: false` leaves them unlinked for good, by design). **Backfill in production** = `POST /intimacoes/sync {"dias": 60}` once, from an admin session; it takes a few minutes because each TRIAGEM case is synced in Datajud.

Original spec (kept for reference):

Files: `services/djen/DjenClient.ts`, `jobs/djen-sync.ts`, migration `0008_*`, `routes/intimacoes.ts`, desktop `intimacoes` page.

1. Schema: `profiles.oab_numero`, `profiles.oab_uf` (editable by admin in Administrativo → Usuários). `firms.oabs_monitoradas jsonb` `[{numero, uf, nome}]` for lawyers who are not app users. Seed for this firm (**confirmed by Rubens 2026-09-18**): RS 62492 (Rafael Plentz Gonçalves), RS 55817 (Mauricio Ferron), RS 127837 (Maria Eduarda Girelli Gonçalves).
2. Table `intimacoes` (`id`, `firm_id`, `external_id` unique `djen:<id>`, `hash`, `numero_processo` (20 digits), `processo_judicial_id` nullable, `sigla_tribunal`, `tipo_comunicacao`, `tipo_documento`, `nome_orgao`, `id_orgao`, `nome_classe`, `codigo_classe`, `texto_html`, `texto_plano`, `link`, `meio`, `data_disponibilizacao date`, `destinatarios jsonb`, `advogados jsonb` (normalized OABs), `ativo`, `motivo_cancelamento`, `lida_em`, `lida_por`, `tarefa_id` nullable, `raw jsonb`, `created_at`) + indexes `(firm_id, data_disponibilizacao desc)`, `(firm_id, processo_judicial_id)`.
3. `DjenClient.listByOab({numero, uf, from, to})`: `itensPorPagina=100`, loop `pagina` until `items.length < 100`; ignore `count`; 500 ms between requests; retry 5xx with backoff; on `403` mark the run `GEOBLOQUEADO` (what a non-Brazilian caller sees — on LXC 103 it means the router's VPN tunnel is down, see `hp-proxmox` skill). Dedupe by `id` across OABs (the two partners share 99% of items). `getCertidao(hash)` → PDF bytes for the documents feature (issue #2).
4. Job `djen-sync` — twice a day, 09:00 and 14:00 America/Sao_Paulo; window = last 3 days (DJEN backfills late publications); upsert by `external_id`; link to the case by `numero_processo` (compare digits with `processos_judiciais.numero_cnj`).
5. **Unknown case is the normal path (82% in the sample).** Default: auto-create the `processo_judicial` with `situacao='TRIAGEM'`, `cliente_id=null`, `numero`/`numero_cnj` from the intimação, `justica`/`orgao_julgador` from the DJEN item, then run the Datajud sync for it (Phase 1) to fill classe/instances/movimentos, and raise a `notificacoes` row "Processo em triagem: vincule o cliente". The Processos list gets a "Triagem" filter/badge. Client linking is manual (party names in `destinatarios` can prefill a search over `clientes.nome`).
6. Prazo → tarefa: on each new `Intimação`/`Citação` create a `tarefa` (`titulo="Intimação — <tipoDocumento> — <numero>"`, `usuario_id` = the profile whose OAB matched, `dataLimite` = `data_disponibilizacao` + 1 business day (publication) + N business days; N default 15 for `Intimação`, 5 for `Ato ordinatório`/`DESPACHO`, 30 for `Citação`; editable). Business-day calendar per Res. CNJ 455 (count starts the next business day) with `firms.feriados jsonb` seeded with national holidays; the AI step (Phase 6) proposes N from `texto_plano`, the human confirms. Skip tarefa creation for `Lista de distribuição`, `Pauta de julgamento`, `Ata de sessão` (informational; still stored and shown).
7. UI: Intimações page (day-grouped list, unread badge, tribunal/tipo filters, full-text drawer with the original `link`, "criar tarefa"/"marcar lida"), plus a section on the case page. Hub card "Intimações de hoje".
8. Tests: fixtures from the real responses captured 2026-09-18 with party names redacted (`apps/server/test/fixtures/djen/`); a run from a non-Brazilian IP must end as `sync_runs.status='GEOBLOQUEADO'` with a clear message, never as success with zero items.

Acceptance: the 60-day backfill for the three OABs stores ~470 intimações, links ~60 to existing cases, creates ~260 cases in `TRIAGEM`, and a second run inserts nothing.

### Phase 4 — Legacy numbers and backfill

1. Migration script `scripts/converter-numeros-antigos.ts`: for `numero` matching `^(\d{4})\.(\d{2})\.(\d{2})\.(\d{6})-(\d)$` (old TRF4 `AAAA.JJ.OO.NNNNNN-D`, JJ=`71` RS, `72` SC, `70` PR), produce `NNNNNNN-DD.AAAA.4.04.JJOO` with DD from the mod-97 rule (§8). Store in a new column `processos_judiciais.numero_cnj` (do not overwrite `numero`, the office searches by the old one). Verified: `2006.71.13.001100-4 → 0001100-32.2006.4.04.7113` is found in Datajud (`grau JE`); `2005.71.04.008352-6 → 0008352-50.2005.4.04.7104` is not (pre-eproc physical case, expected).
2. `numero_cnj` is what every sync uses; `numero` stays the display/search key. Add a unique index `(firm_id, numero_cnj)` where not null.
3. One-off backfill job (`npm run sync:backfill`) that runs Phase 2's chunked sync over all cases including archived ones, with a progress log; expect ~75 requests and a few minutes.

### Phase 5 — INSS (administrative cases)

There is no API. The realistic plan, in order of value:

1. **Data model**: extend `processos_administrativos` with `nb` (número do benefício), `protocolo` (requerimento), `der` (data de entrada), `dib`, `situacao` (`EM_ANALISE|EXIGENCIA|CONCLUIDO_DEFERIDO|CONCLUIDO_INDEFERIDO|RECURSO`), `orgao` (APS), `ultima_verificacao`. Keep `numero` for the legacy value.
2. **Document import**: a "Importar documento do INSS" action on the administrative case that accepts PDF (CNIS, HISCRE, carta de concessão, comunicado de decisão, extrato de requerimento from Meu INSS/PAT) → store the file (ties into issue #2's LAN folder) → parse with `pdf-parse` (ask before adding the dependency) → extract NB, DER, espécie, situação, vínculos (CNIS table) into structured JSON `documentos_inss` (`tipo`, `extraido jsonb`, `arquivo`, `importado_em`) → propose field updates → human confirms. The local LLM already wired for `/dashboard/resumo-ia` (LM Studio) can normalize the free text; the arithmetic (tempo de contribuição) stays deterministic.
3. **Procuração eletrônica workflow**: checklist on the client (`clientes.procuracao_inss_ate date`, `clientes.govbr_nivel`), so the office knows which clients granted access in Meu INSS (OAB guidance, late 2025). This is what makes PAT/GERID mirroring usable by the lawyer manually.
4. **Not recommended now**: RPA on Meu INSS/PAT with the lawyer's credentials. It requires TOTP on the lawyer's account, runs from Brazil, and is exactly what broke Astrea in 2024. Revisit only if INSS ships an API for lawyers; monitor `docs.pdpj.jus.br/servicos-negociais/previdenciario/` (Prevjud, judiciary-only today).
5. **Judicial side of previdenciário is already covered**: JEF cases show up in Datajud as `grau: JE` and `TR` under `api_publica_trf4` (33 JE + 19 TR docs among the 50 sampled).

### Phase 6 — AI on top (after 1–3 are stable)

- Summarize a case's andamentos across instances (prompt = normalized rows, not raw JSON).
- Extract prazo, ato and "o que fazer" from `intimacoes.texto` → prefill the tarefa; model proposes, human confirms.
- Weekly digest per lawyer (OAB): new intimações, cases that stalled > 90 days, tarefas due.
- Optional commercial aggregator (Judit tracking webhooks or Escavador) only for tribunals not in Datajud or when eproc documents (PDFs) are needed.

---

## 5. Where the DJEN caller runs — decided and verified: server-side, through the home router's VPN

Verified: DJEN answers only to Brazilian IPs; Datajud answers from anywhere. The desktop app runs in Brazil on the lawyers' machines; the API server runs on the Proxmox host (LXC 103) in the US.

**Decision (2026-09-18, verified live):** the DJEN job stays on the server (one fetch per run for the whole firm). LXC 103's traffic is routed through the home router's existing NordVPN Brazil OpenVPN client with an Asuswrt-Merlin **VPN Director** rule (`192.168.50.127 → OVPN1`). No sidecar, no VPN key on the server, no relay: `DjenClient` calls `comunicaapi.pje.jus.br` directly (`DJEN_TRANSPORT=direct`).

Verified from inside LXC 103 after the change: egress `BR`, `GET /api/v1/comunicacao?numeroOab=62492&ufOab=RS` → `200` with the day's intimações, Datajud `200`, GitHub `200`, and the public API through the Cloudflare tunnel healthy.

Operational facts (full detail and troubleshooting in the `hp-proxmox` skill, Router section):

- The router's kill switch for routed clients is **off** on purpose: if the tunnel drops, LXC 103 falls back to the WAN, the API and Cloudflare tunnel stay up, and only DJEN answers `403` until the tunnel returns. The DJEN job must therefore treat `403` as `GEOBLOQUEADO` in `sync_runs`, never as "no intimações".
- NordVPN retires servers; when that happens the client shows `state=-1` with TLS timeouts. The fix is a new `brNNN.nordvpn.com` in **both** the server address and the `verify-x509-name` line, plus current service credentials. All three bit on 2026-09-18.
- smartlawdb's IP `192.168.50.127` must get a DHCP reservation (MAC `bc:24:11:b2:f8:a7`), or the VPN Director rule silently stops matching if the lease moves.
- If the API ever moves to Brazil (§5.2 below), nothing changes in the code.

### 5.1 Rejected alternatives (kept for the record)

- **gluetun/NordVPN sidecar on LXC 103** — would work (kernel has WireGuard, container needs `/dev/net/tun`), but duplicates a VPN the router already runs.
- **Whole LXC behind a consumer VPN app** — a drop would take the API down; the router approach avoids this only because the kill switch is off.
- **Desktop-side fetch** — three desktops would fetch the same feed; runs only while the app is open; splits sync logic across client and server.
- **Relay in the law office / Oracle free tier** — extra infrastructure for the same result.

### 5.2 Later — move the API + Postgres to Brazil (separate project)

Still worth considering for latency (every user is in Brazil) and LGPD simplicity: Oracle Cloud Free Tier São Paulo, same Cloudflare Tunnel and `deploy-prod.sh` flow, Proxmox as backup target. Set `DJEN_TRANSPORT=direct` (already the default) and the router rule becomes unnecessary.

## 6. Config

| Var | Where | Purpose |
|---|---|---|
| `DATAJUD_API_KEY` | server `.env` | CNJ public key (fallback when `firms.datajud_api_key` is null). Replace the placeholder in dev and prod. |
| `SCHEDULER_ENABLED` | server | default `true` in prod, `false` in tests. |
| `DATAJUD_SYNC_INTERVAL_MIN` | server | default `360`. |
| `DJEN_SYNC_TIMES` | server | default `08:00,13:00` (America/Sao_Paulo). |
| `DJEN_TRANSPORT` | server | `direct` (default; LXC 103 exits through the router VPN, §5) or `relay` (only if the routing setup ever goes away). Implemented in `env.ts` (Phase 3). |
| `BR_RELAY_URL`, `BR_RELAY_TOKEN` | server | Only when `DJEN_TRANSPORT=relay`; the server refuses to start with `relay` and no URL. Unset by default. |
| `NTFY_URL` | server | optional push. |

Add them to `apps/server/.env.example` and to `env.ts` (validate types, do not require).

---

## 7. Data-model summary (Drizzle, `apps/server/src/db/schema.ts`)

New: `processo_instancias` (done, 0007), `intimacoes` + `sync_runs` (done, 0008), `notificacoes`, `documentos_inss`.
Altered: `processos_judiciais.numero_cnj`; `profiles.oab_numero`, `profiles.oab_uf`; `firms.oab_extras`, `firms.feriados`, `firms.ntfy_topic`; `processos_administrativos.{nb, protocolo, der, dib, situacao, orgao}`; `clientes.procuracao_inss_ate`.
Every new table has `firm_id not null` + index; every job query filters by it. Generate migrations with `npm run db:generate --name <slug> -w apps/server` (next tag is `0009_*`; 0007 = `processo_instancias`, 0008 = `intimacoes` + `sync_runs` + OAB/feriados columns).

---

## 8. Reference algorithms

**CNJ number → Datajud alias** (`NNNNNNN-DD.AAAA.J.TR.OOOO`):

| J | TR | alias |
|---|---|---|
| 1 | 00 | `api_publica_stf` |
| 2 | 00 | *(CNJ — no public index; throw)* |
| 3 | 00 | `api_publica_stj` |
| 4 | 01–06 | `api_publica_trf{n}` |
| 5 | 00 | `api_publica_tst`; 01–24 → `api_publica_trt{n}` |
| 6 | 00 | `api_publica_tse`; else `api_publica_tre-{uf}` |
| 7 | 00 | `api_publica_stm` |
| 8 | 01–27 | `api_publica_tj{uf}` (`07` → `api_publica_tjdft`) |
| 9 | 13/21/26 | `api_publica_tjmmg` / `tjmrs` / `tjmsp` |

UF table for J=8/6: 01 ac, 02 al, 03 ap, 04 am, 05 ba, 06 ce, 07 dft, 08 es, 09 go, 10 ma, 11 mt, 12 ms, 13 mg, 14 pa, 15 pb, 16 pr, 17 pe, 18 pi, 19 rj, 20 rn, 21 rs, 22 ro, 23 rr, 24 sc, 25 se, 26 sp, 27 to.

**Check digits** (Res. CNJ 65/2008): `DD = 98 − ((NNNNNNN AAAA J TR OOOO · 100) mod 97)`; validate incoming numbers with the same rule and reject invalid ones in `processoJudicialSchema`.

**Old TRF4 format** `AAAA.JJ.OO.NNNNNN-D` → `0NNNNNN-DD.AAAA.4.04.JJOO`.

---

## 9. Open questions for Rubens

Answered 2026-09-18: OABs RS 62492, RS 55817, RS 127837 are the firm's lawyers (confirmed); DJEN runs server-side and LXC 103 exits through the home router's NordVPN Brazil tunnel, verified live (§5).

Still open (none blocks Phase 1/2):

1. **Production database vs. the April dump**: 263 of the firm's 321 active DJEN cases are absent from the backup. Is production more complete, or are new cases not being registered? This decides how heavily the `TRIAGEM` auto-create path is used (the plan assumes: heavily).
2. ~~VPN provider~~ Answered: router-level routing, no sidecar (§5). Pending: DHCP reservation for 192.168.50.127 on the router.
3. **Push notifications**: ntfy on the lawyers' phones, or in-app only?
4. **INSS documents**: which PDFs the office actually downloads today (CNIS, HISCRE, carta de concessão, extrato do requerimento). Send 2–3 samples to build the parsers.
5. **Datajud ToS**: internal use by the firm fits "fins legais e autorizados"; if smartlaw is ever sold to other firms, art. 3.8 (no commercial exploitation) needs a legal read.

## 10. Sources

- Datajud: `datajud-wiki.cnj.jus.br/api-publica/{acesso,endpoints,glossario,termo-uso}`
- DJEN Swagger: `api.swaggerhub.com/apis/cnj/pcp/1.0.0`; product page `comunica.pje.jus.br/sobre`; Res. CNJ 455/2022 (`atos.cnj.jus.br/atos/detalhar/4509`)
- PDPJ: `docs.pdpj.jus.br` (SSO, portal-servicos); `consultaprocessual.pdpj.jus.br/assets/config/env.js`
- INSS: OAB Nacional notícia 64215 (procuração eletrônica no Meu INSS), OAB-RS INSS Digital (`www2.oabrs.org.br/inssDigital/`), Astrea/Aurum Meu INSS integration note (lawletter.com.br)
- Probe script with every request above: `scripts/probe-court-apis.sh`
