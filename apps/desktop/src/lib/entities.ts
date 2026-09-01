// Entity types derived from the server's actual route responses.
//
// This is the single source of truth for the shapes the desktop consumes: the
// Hono client infers them from the route handlers, so they track the server
// automatically and reflect the JSON wire format (timestamps as strings, not
// Date objects). The `200` status argument selects the success shape, excluding
// the error branches (e.g. 404 `{ error }`).
//
// Input types (what forms submit) stay in @smartlaw/shared as Zod schemas.
import type { InferResponseType } from 'hono/client';
import { api } from './api';

export type Cliente = InferResponseType<(typeof api.clientes)[':id']['$get'], 200>;

export type Tarefa = InferResponseType<(typeof api.tarefas)[':id']['$get'], 200>;

export type ProcessoJudicial = InferResponseType<
  (typeof api.processos.judiciais)[':id']['$get'],
  200
>;

export type ProcessoAdministrativo = InferResponseType<
  (typeof api.processos.administrativos)[':id']['$get'],
  200
>;

export type Honorario = InferResponseType<(typeof api.honorarios)[':id']['$get'], 200>;

// The list endpoint returns a narrower row than the detail endpoint (no
// created/updated timestamps); the financeiro screen works with these.
export type HonorarioListItem = InferResponseType<typeof api.honorarios.$get, 200>['data'][number];

// HonorarioSummary stays in @smartlaw/shared — the server produces it too.

export type DashboardStats = InferResponseType<typeof api.dashboard.$get, 200>;

// List endpoints return arrays; take the element type.
export type Usuario = InferResponseType<typeof api.usuarios.$get, 200>[number];

export type AuditLog = InferResponseType<(typeof api)['audit-logs']['$get'], 200>[number];

export type AndamentoRecente = InferResponseType<typeof api.dashboard.recentes.$get, 200>[number];

// The authenticated profile, from /auth/me's `{ user }` envelope.
export type User = InferResponseType<typeof api.auth.me.$get, 200>['user'];
