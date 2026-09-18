// Entity/response types are derived from the server routes on the desktop side
// (apps/desktop/src/lib/entities.ts) via Hono's InferResponseType — the schema
// is the single source of truth and packages/shared, a dependency leaf, cannot
// import it without a cycle.
//
// What remains here is shared with the server: the Datajud external API shape
// and the drift-comparison result, both used by apps/server's services.

/**
 * Um documento da API pública do Datajud (CNJ). O Datajud guarda UM documento
 * por instância (`grau`: G1, G2, JE, TR…), então um processo com apelação tem
 * dois documentos com o mesmo `numeroProcesso`. Os `movimentos` chegam sem
 * ordem garantida. Formato verificado contra respostas reais em 2026-09-18.
 */
export interface DatajudProcessData {
  id?: string;
  numeroProcesso: string;
  tribunal?: string;
  grau?: string;
  classe?: { codigo?: number; nome: string };
  sistema?: { codigo?: number; nome: string };
  formato?: { codigo?: number; nome: string };
  /** `YYYYMMDDHHmmss`, sem fuso (tratado como UTC, igual aos movimentos). */
  dataAjuizamento?: string;
  nivelSigilo?: number;
  orgaoJulgador?: { nome: string; codigo?: number | string; codigoMunicipioIBGE?: number };
  assuntos?: Array<{ codigo?: number; nome: string }>;
  dataHoraUltimaAtualizacao?: string;
  '@timestamp'?: string;
  movimentos?: DatajudMovimento[];
}

export interface DatajudMovimento {
  codigo?: number;
  nome: string;
  /** ISO 8601 com `Z`. */
  dataHora: string;
  orgaoJulgador?: { nome: string; codigo?: number | string };
  complementosTabelados?: Array<{
    codigo?: number;
    descricao?: string;
    valor?: number | string;
    nome?: string;
  }>;
}

export interface DriftResult {
  hasDrift: boolean;
  fields: Array<{
    field: string;
    local: unknown;
    remote: unknown;
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
