# Fluxos de trabalho (workflow automations)

Admins define rules of the form **Quando → Se → Então**: when something happens
to a client, optionally filtered by conditions, run an ordered list of actions —
change the client's situação, create a tarefa for a specific person.

The motivating example, shipped as a one-click template in the editor:

> Quando um cliente for cadastrado: mudar a situação para *Em revisão*; criar a
> tarefa “Coletar documentos de {{cliente.nome}}” para *Ana (secretaria)*, prazo
> de 3 dias úteis.

## Decisions

| Question | Decision |
|---|---|
| Who creates and edits workflows | `admin` only (`PERFIS_FLUXOS` in `middleware/perfil.ts`). Everyone else just sees the effects. |
| Client statuses | Configurable per firm (`cliente_situacoes`). `A`/`I` are system rows and can't be deleted. |
| Who gets the task | A specific person chosen in the workflow (the firm's secretaria is one person today). If that person is later deactivated, the task goes to the oldest active admin — same fallback as DJEN. |
| Model | Rule list, not a state machine or canvas: covers "change status + create assigned tasks" with a plain form and no new dependency. Chaining comes from the `CLIENTE_SITUACAO_ALTERADA` trigger. |

## How it works

**Data** (migration `0011_fluxos_de_trabalho.sql`):

- `cliente_situacoes` — per-firm statuses (`codigo`, `nome`, `cor`,
  `conta_como_ativo`, `ordem`, `sistema`). `clientes.situacao` stores the
  `codigo`. Seeded with `A`, `EM_REVISAO`, `I` for existing firms; a firm created
  later gets the same set lazily on first read (`listarSituacoes`).
- `workflows` — `gatilho`, `condicoes jsonb`, `acoes jsonb`. JSON because a
  workflow is always read and written whole; the shape is enforced by
  `workflowSchema` in `packages/shared` on every save.
- `workflow_execucoes` — one row per run: `SUCESSO` / `ERRO` / `IGNORADO`, a
  human-readable `resultado` list, the error message for admins.
- `tarefas.workflow_execucao_id` — which run created the task.
- `tarefas.cliente_id` is now `ON DELETE CASCADE`: every new client can carry a
  workflow task, and without it deleting a client hit the foreign key.

**Engine** (`apps/server/src/services/workflows/`): `dispararEvento` is called
by the clientes routes *after* their own write. For each active workflow of the
firm with that trigger whose conditions match, it runs the actions in one
transaction and logs the run. It never throws — a broken workflow (e.g. a
situação deleted by hand) rolls back its own actions, is logged as `ERRO`, and
the client is still saved. The route then returns the client as the workflow
left it.

Loop protection: changing the situação emits `CLIENTE_SITUACAO_ALTERADA`, which
can trigger other workflows. Each workflow runs at most once per chain and the
chain is capped at `MAX_ENCADEAMENTO = 3`; anything cut off is logged as
`IGNORADO`.

Deadlines count office business days: weekends, national holidays and
`firms.feriados` are skipped, but the court recess (20/12–20/01) is **not** — the
office works then even though procedural deadlines are suspended. That's why
the engine does not reuse `ehDiaUtil` from `djen/prazos.ts`.

**Triggers and actions today**

| Trigger | Conditions |
|---|---|
| `CLIENTE_CRIADO` (`POST /clientes`) | tipo de cliente |
| `CLIENTE_SITUACAO_ALTERADA` (`PUT /clientes/:id`, or another workflow) | tipo de cliente, situação anterior, nova situação |

| Action | Fields |
|---|---|
| `ALTERAR_SITUACAO_CLIENTE` | situação |
| `CRIAR_TAREFA` | título/descrição with `{{cliente.nome}}` and `{{usuario.nome}}`, responsável, prazo (dias úteis/corridos or none), prioridade, categoria |

**API**: `/workflows` (CRUD, `PATCH /:id/ativo`, `GET /execucoes`) and
`/cliente-situacoes` (read for everyone, write for admins). References are
checked on save: situações and responsáveis must belong to the same firm.

**Desktop**: sidebar entry *Fluxos de trabalho* (admin only) with tabs
Fluxos / Situações de cliente / Histórico; editor at `/fluxos/novo` and
`/fluxos/$id`. The Clientes list now defaults to **Ativos** (every situação
with `conta_como_ativo`), so a client moved to *Em revisão* does not vanish from
the default view; badges and the form read names and colours from the firm's
situações.

## Rollout note

Desktop 0.3.0 still hardcodes `A`/`I`: it shows any other situação as
"Inativo" and its default filter (`situacao=A`) hides those clients. Nothing
breaks until an admin enables a workflow or creates a new situação, but the
release that ships this screen should raise `VERSAO_MINIMA_APP` to its own
version in the same release PR (it can't go above the current app version
before that).

## Next phases

1. **Task-completion chaining** — `TAREFA_CONCLUIDA` trigger ("when the
   documents task is done, move the client to Ativo and give the lawyer a
   task"), filtered by the workflow that created the task
   (`tarefas.workflow_execucao_id` is already there for this). Detect the
   transition to `CONCLUIDA` in `PUT /tarefas/:id`.
2. **Processo triggers** — `PROCESSO_JUDICIAL_CRIADO` /
   `PROCESSO_ADMINISTRATIVO_CRIADO`, with actions scoped to the processo.
3. **Court events** — intimação received (DJEN), processo archived (Datajud
   `classificarSituacao`). These fire from the sync jobs, not from a user, so
   `disparadoPor` is null.
4. **Delayed actions** ("3 days later, if still in review…") — needs the
   scheduled-job infrastructure the batch sync also needs.
5. Possibly: assign to "whoever triggered it" or to a role queue, if the office
   grows past one person per role.
