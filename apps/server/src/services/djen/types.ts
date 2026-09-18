/**
 * Formato real de `GET /api/v1/comunicacao` do DJEN (comunicaapi.pje.jus.br),
 * capturado em 2026-09-18. Os nomes misturam snake_case e camelCase porque a
 * API mistura — não "arrumar" aqui; a normalização fica em normalizar.ts.
 */
export interface DjenAdvogado {
  id?: number;
  nome: string;
  numero_oab: string;
  uf_oab: string;
}

export interface DjenDestinatario {
  nome: string;
  polo?: string | null;
  comunicacao_id?: number;
}

export interface DjenItem {
  id: number;
  hash: string;
  /** `yyyy-mm-dd` (o campo `datadisponibilizacao`, sem underscore, é `dd/mm/yyyy`). */
  data_disponibilizacao: string;
  siglaTribunal: string;
  /** Intimação, Citação, Lista de distribuição, Pauta de julgamento, Ata de sessão, Edital… */
  tipoComunicacao: string;
  /** Ato ordinatório, DESPACHO/DECISÃO, Sentença, Acórdão, Outros… */
  tipoDocumento?: string | null;
  nomeOrgao?: string | null;
  idOrgao?: number | null;
  nomeClasse?: string | null;
  codigoClasse?: string | null;
  /** 20 dígitos. */
  numero_processo: string;
  numeroprocessocommascara?: string | null;
  /** `D` = DJEN, `E` = Plataforma Nacional de Editais. */
  meio?: string | null;
  meiocompleto?: string | null;
  link?: string | null;
  /** HTML completo do ato. */
  texto?: string | null;
  numeroComunicacao?: number | null;
  ativo?: boolean | null;
  status?: string | null;
  motivo_cancelamento?: string | null;
  data_cancelamento?: string | null;
  destinatarios?: DjenDestinatario[] | null;
  destinatarioadvogados?: Array<{ advogado: DjenAdvogado }> | null;
}

export interface DjenResposta {
  status: string;
  message?: string;
  /** Não confiável: com página ≥ 200 vem igual ao tamanho da página. */
  count?: number;
  items: DjenItem[];
}
