// Entity/response types are derived from the server routes on the desktop side
// (apps/desktop/src/lib/entities.ts) via Hono's InferResponseType — the schema
// is the single source of truth and packages/shared, a dependency leaf, cannot
// import it without a cycle.
//
// What remains here is shared with the server: the Datajud external API shape
// and the drift-comparison result, both used by apps/server's services.

export interface DatajudProcessData {
  numeroProcesso: string;
  classe?: { nome: string };
  sistema?: { nome: string };
  formato?: { nome: string };
  tribunal?: string;
  dataAjuizamento?: string;
  orgaoJulgador?: { nome: string; codigo?: string };
  movimentos?: Array<{
    nome: string;
    dataHora: string;
    complementosTabelados?: Array<{ nome: string; valor?: string }>;
  }>;
}

export interface DriftResult {
  hasDrift: boolean;
  fields: Array<{
    field: string;
    local: any;
    remote: any;
  }>;
  newMovements: number;
}

// Produced by the server's /honorarios/summary handler and cast to there, so it
// is a genuine shared contract rather than a desktop-only response type.
export interface HonorarioSummary {
  totalRecebido: number;
  totalPendente: number;
  totalAtrasado: number;
}
