# SmartLaw — test playbook for AI agents

Instructions any agent (Claude, Gemini, Codex…) can follow to test SmartLaw end to end:
run the automated suites, exercise every screen as every role, probe the API, and report
**new** bugs and UX improvements with evidence.

How to use it: open the repo in your agent and say
*"Follow `tests/AGENT_TEST_PLAYBOOK.md`"* — optionally adding a scope, for example
*"only section 4.2"* or *"only the Financeiro screen"*.

---

## 0. Hard rules

1. **Local only.** Use the local Docker Postgres (`localhost:5432`, database `smartlaw`) and
   the local API on `http://localhost:3001`. Never call the production API
   (`smartlaw-api.rubenspg.com`), never SSH anywhere, never point `DATABASE_URL` elsewhere.
2. **No secrets.** Don't open, print or copy any `.env` file, password manager item, SSH key
   or token. If a step needs one, stop and ask the human.
3. **No real client data.** Files matching `*_backup.sql` / `*.dump` (gitignored) can hold a
   real database with clients' personal data. Never open, load or restore them.
   The DJEN fixtures in `apps/server/test/fixtures/djen/` are real court responses with
   names replaced — read-only.
4. **Test and report only.** No code changes, commits, pushes, branches or PRs unless the
   human asks. Propose fixes as diffs inside the report.
5. **Leave no trace.** Everything you create uses the prefix `AGENTE-` (records) or
   `agente-` (e-mails) so the cleanup in section 7 removes it.

---

## 1. Read first

| File | Why |
|---|---|
| `CLAUDE.md` | Architecture and every non-obvious rule (multi-tenancy, roles, Datajud, DJEN, workflows, dates). Applies to any agent. |
| `docs/FLUXOS_DE_TRABALHO.md` | Workflow rules ("quando → se → então"). |
| `docs/INTEGRACAO_TRIBUNAIS_INSS.md` | Court/INSS integrations. |
| `packages/shared/src/validation.ts` | Every input schema and enum. |
| `apps/server/src/routes/` | The API surface (`index.ts` lists all routes). |
| `apps/desktop/src/routes/` | Every screen (file-based routes). |

Rules the code must respect (the ones most worth testing):

- **Multi-tenancy is manual**: every business table has `firm_id` and there is no row-level
  security. Every read and every update/delete `where` must filter by the user's firm, and
  every submitted foreign key (clienteId, processoJudicialId, processoAdminId, usuarioId…)
  must belong to that firm.
- **Authorization is an allowlist**: `requirePerfil(...)` in `apps/server/src/middleware/perfil.ts`.
  Profiles: `admin`, `administrativo`, `secretaria`, `usuario`.
- Date-only values are stored as midnight UTC and formatted by `apps/desktop/src/lib/datas.ts`;
  real times are shown in `America/Sao_Paulo`.
- DJEN only answers Brazilian IPs: locally every sync ends `GEOBLOQUEADO`. That's expected.
- Datajud may answer 429 when CNJ's cluster is overloaded; manual sync gives up after 20 s.

Domain words (UI is pt-BR): cliente, processo (judicial / administrativo), andamento (docket
entry), honorário (fee), tarefa (task), perfil (role), escritório/firma (firm), intimação
(court notice), prazo (deadline), situação (status).

---

## 2. Setup

```bash
docker compose up -d postgres             # Docker must be running
npm install
npm run db:migrate -w apps/server
npm run dev -w apps/server                # API on :3001  — keep running
npm run dev -w apps/desktop               # UI on :1420   — keep running
```

The desktop app is the page at `http://localhost:1420` inside Tauri; test it in any browser.
If the UI can't reach the API, set the server URL on the login screen's settings (gear) to
`http://localhost:3001`.

**Known navigation quirk:** reloading a deep URL lands on Início. Navigate with the sidebar,
or in a script: `history.pushState({}, '', '/clientes'); dispatchEvent(new PopStateEvent('popstate'))`.

### 2.1 Test users and data

Create your own users — never use or reset someone else's password. Run from the repo root:

```bash
HASH=$(node -e "console.log(require('bcryptjs').hashSync('Agente-Local-123',10))" 2>/dev/null \
  || (cd apps/server && node -e "console.log(require('bcryptjs').hashSync('Agente-Local-123',10))"))

docker exec -i smartlaw-db psql -U smartlaw -d smartlaw -v ON_ERROR_STOP=1 -v hash="$HASH" <<'SQL'
-- Two firms, so cross-tenant access can be tested.
insert into firms (nome) values ('AGENTE Firma A'), ('AGENTE Firma B');

-- One user per profile in firm A, one admin in firm B. Password: Agente-Local-123
insert into profiles (nome, email, password_hash, perfil, firm_id)
select 'AGENTE '||p, 'agente-'||p||'@smartlaw.test', :'hash', p, (select id from firms where nome='AGENTE Firma A')
from unnest(array['admin','administrativo','secretaria','usuario']) p;
insert into profiles (nome, email, password_hash, perfil, firm_id)
values ('AGENTE admin B', 'agente-admin-b@smartlaw.test', :'hash', 'admin', (select id from firms where nome='AGENTE Firma B'));

-- Fictional data for both firms.
insert into clientes (firm_id, tipo, nome, cpf_cnpj, celular, email, situacao)
select f.id, 'F', 'AGENTE-Cliente '||f.nome||' '||g,
       lpad((g*7919)::text, 11, '0'), '5499'||lpad(g::text,7,'0'), 'agente-c'||g||'@exemplo.com', 'A'
from firms f, generate_series(1, 30) g where f.nome like 'AGENTE Firma%';

insert into processos_judiciais (firm_id, cliente_id, numero, data_cadastro, distribuicao, pasta)
select c.firm_id, c.id, lpad((5000000+c.id)::text,7,'0')||'-00.2024.8.21.0090',
       now() - (c.id % 40 || ' days')::interval, date '2024-03-15', 'AGENTE-P'||c.id
from clientes c where c.nome like 'AGENTE-Cliente%' and c.id % 2 = 0;

insert into andamentos (firm_id, processo_judicial_id, data, inclusao, historico, tipo)
select p.firm_id, p.id, current_date - g, now() - (g || ' days')::interval,
       'AGENTE-andamento '||g, 'MANUAL'
from processos_judiciais p, generate_series(0, 2) g where p.pasta like 'AGENTE-P%';

insert into tarefas (firm_id, usuario_id, cliente_id, titulo, data_limite, prioridade, status, categoria)
select c.firm_id,
       (select id from profiles where firm_id = c.firm_id and email like 'agente-%' order by email limit 1),
       c.id, 'AGENTE-tarefa '||c.id, now() + ((c.id % 9 - 4) || ' days')::interval,
       (array['BAIXA','MEDIA','ALTA'])[1 + c.id % 3],
       case when c.id % 7 = 0 then 'CONCLUIDA' else 'PENDENTE' end,
       (array['GERAL','PRAZO','AUDIENCIA','REUNIAO'])[1 + c.id % 4]
from clientes c where c.nome like 'AGENTE-Cliente%' and c.id % 3 = 0;

insert into honorarios (firm_id, cliente_id, descricao, valor, valor_pago, data_venc, data_pagto, status, tipo)
select c.firm_id, c.id, 'AGENTE-honorário '||c.id, 1000 + c.id * 10,
       case when c.id % 4 = 0 then 1000 + c.id * 10 when c.id % 4 = 1 then 300 else null end,
       current_date + (c.id % 20 - 10)::int,
       case when c.id % 4 = 0 then current_date - 1 else null end,
       case when c.id % 4 = 0 then 'PAGO' when c.id % 9 = 0 then 'CANCELADO' else 'PENDENTE' end,
       'HONORARIO'
from clientes c where c.nome like 'AGENTE-Cliente%';
SQL
```

Log in at `http://localhost:1420` as `agente-admin@smartlaw.test` (or any other profile)
with `Agente-Local-123`. For API calls:

```bash
TOKEN=$(curl -s localhost:3001/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"agente-admin@smartlaw.test","password":"Agente-Local-123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s localhost:3001/clientes -H "Authorization: Bearer $TOKEN" -H 'X-App-Version: 0.4.0'
```

---

## 3. Automated checks

```bash
npm run lint
npm run typecheck
npm test                    # unit (vitest)
npm run test:integration    # needs local Postgres; uses database smartlaw_test
```

Record pass/fail counts. Report failures, flaky tests, and important paths with no tests.

---

## 4. What to test

### 4.1 Every screen × every role

Sidebar: Início, Agenda, Clientes, Processos, Financeiro, Insights, Fluxos de trabalho,
Administrativo, Configurações. Also: cliente detail / novo / editar; processo judicial and
administrativo detail / novo / editar; Nova Tarefa dialog (from Início and Agenda);
Novo lançamento (Financeiro); Novo fluxo; each Configurações tab.

For each screen and each of the four profiles:
- loads without console errors; empty, loading and error states make sense;
- every button and link does what it says; destructive actions ask for confirmation;
- forms validate (CPF/CNPJ, e-mail, dates, money, required fields) with clear pt-BR messages;
- the role sees only what it should (compare with the "Regras de Perfis" card in Administrativo);
- pagination, search and filters return correct, stable results.

### 4.2 API and security (call the API directly)

- **Tenant isolation**: with firm B's admin token, read/update/delete firm A's records by id
  on every route, and create firm-B records that reference firm-A ids.
- **Roles**: every route against the four profiles; look for missing or inline checks.
- **Session**: token lifetime; what happens after logout, password change, deactivation,
  demotion and deletion of the user.
- **Input**: very large bodies, negative/NaN/huge ids, `%` and `_` in search, unbounded
  `limit`, invalid dates, HTML/script in text fields and how the UI renders them.
- **Leaks**: the firm's Datajud key must never reach the client (`GET /firms/me` exposes only
  `hasDatajudKey`); errors must not return stack traces, SQL or payloads.
- **Login rate limiting** on `/auth/login`.
- **Agenda iCal feed** (`/agenda/calendar/:token/*.ics`): what a leaked URL exposes, rotation.

### 4.3 Business logic

- **Tarefas**: assignment, team (unassigned) tasks, who may edit/complete/delete, overdue and
  "today" across time zones (office is `America/Sao_Paulo`; test near midnight in UTC too).
- **Financeiro**: summary cards vs table totals, partially paid and cancelled fees,
  month/year filters, overdue rules, rounding.
- **Fluxos de trabalho**: each trigger (cliente cadastrado, mudança de situação, tarefa
  concluída), conditions, actions, duplicate firing, and that a failing workflow never
  blocks the original save (`workflow_execucoes` gets `ERRO`).
- **Datajud** (`apps/server/src/services/datajud/`): multiple instances, idempotency (sync
  twice → no duplicate andamentos), `classificarSituacao`.
- **DJEN** (`apps/server/src/services/djen/`): business-day prazo calendar, task creation per
  OAB, unknown case → `TRIAGEM`. Network is geoblocked locally: review code + integration tests.
- **AI summaries** (`services/resumo`, `services/insights`, `services/ia`): confirm only
  aggregate counts go to the model — no names, CPFs, case numbers or free text.

### 4.4 UX review

Judge it as a Brazilian law office uses it daily (secretaries, lawyers, an admin):
- clicks needed for common jobs: register a client and their case; log a phone call; find a
  client by CPF or phone; see today's deadlines; record a payment;
- information density, navigation, consistency of labels/casing/buttons, pt-BR copy;
- accessibility: keyboard-only use, focus order, contrast, labels, screen-reader names;
- small window sizes (1024 px and narrower) and dark mode.

---

## 5. Before reporting: is it already known?

Check `gh issue list --state all --limit 200` (and the issue bodies of security issues such
as #76), plus earlier reports in `tests/reports/`. Report only what is new, or a known issue
with materially new evidence (say which issue).

---

## 6. Report

Write it to `tests/reports/YYYY-MM-DD-<agent>.md` (this folder is gitignored because reports
can describe unfixed vulnerabilities — never paste them into issues, PRs or chat in public).

1. **Summary** — at most 5 lines: readiness and the top 3 risks.
2. **Findings** — most severe first:
   `ID | Severity (critical/high/medium/low) | Area | Title | Evidence | Suggested fix`.
   Evidence is mandatory: `file:line` and the exact request or click path with the observed
   result. Mark anything you didn't reproduce as `UNVERIFIED`.
3. **UX improvements** — up to 15: problem → proposal → benefit, ranked by daily impact,
   naming the screen.
4. **Missing tests** — test names and what each would assert.
5. **Commands run** — with pass/fail counts.
6. **Cleanup** — confirm section 7 ran and what it removed.

Be precise and skeptical: no generic advice, no finding without evidence.

---

## 7. Cleanup

```bash
docker exec -i smartlaw-db psql -U smartlaw -d smartlaw -v ON_ERROR_STOP=1 <<'SQL'
begin;
delete from andamentos   where historico like 'AGENTE-%' or processo_judicial_id in (select id from processos_judiciais where pasta like 'AGENTE-%');
delete from tarefas      where titulo like 'AGENTE-%' or firm_id in (select id from firms where nome like 'AGENTE Firma%');
delete from honorarios   where descricao like 'AGENTE-%' or firm_id in (select id from firms where nome like 'AGENTE Firma%');
delete from processos_judiciais      where firm_id in (select id from firms where nome like 'AGENTE Firma%');
delete from processos_administrativos where firm_id in (select id from firms where nome like 'AGENTE Firma%');
delete from workflow_execucoes where firm_id in (select id from firms where nome like 'AGENTE Firma%');
delete from workflows          where firm_id in (select id from firms where nome like 'AGENTE Firma%');
delete from cliente_situacoes  where firm_id in (select id from firms where nome like 'AGENTE Firma%');
delete from clientes           where firm_id in (select id from firms where nome like 'AGENTE Firma%');
delete from profiles           where email like 'agente-%@smartlaw.test';
delete from firms              where nome like 'AGENTE Firma%';
commit;
SQL
```

If you created records some other way (through the UI), delete them by their `AGENTE-` prefix
as well, and say so in the report.
