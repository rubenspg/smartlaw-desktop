import type { DatajudProcessData } from '@smartlaw/shared';
import { aliasDatajud, somenteDigitos } from './cnj';
import { ordenarInstancias } from './normalizar';

const BASE_URL = 'https://api-publica.datajud.cnj.jus.br';

/**
 * De onde veio a chave usada numa chamada. A chave pública que o CNJ publica em
 * datajud-wiki.cnj.jus.br/api-publica/acesso não é segredo, mas o CNJ avisa que
 * pode trocá-la a qualquer momento — por isso vive em DATAJUD_API_KEY ou em
 * firms.datajud_api_key, nunca no código.
 */
export type OrigemChave = 'firma' | 'ambiente' | 'nenhuma';

export function resolverChave(chaveFirma?: string | null): { chave: string | null; origem: OrigemChave } {
  const daFirma = chaveFirma?.trim();
  if (daFirma) return { chave: daFirma, origem: 'firma' };
  const doAmbiente = process.env.DATAJUD_API_KEY?.trim();
  // O placeholder do .env.example não é uma chave.
  if (doAmbiente && doAmbiente !== 'your-datajud-api-key') return { chave: doAmbiente, origem: 'ambiente' };
  return { chave: null, origem: 'nenhuma' };
}

export type TipoErroDatajud = 'sem_chave' | 'chave_invalida' | 'http' | 'rede';

export class DatajudError extends Error {
  constructor(
    public readonly tipo: TipoErroDatajud,
    mensagem: string,
    public readonly status?: number,
  ) {
    super(mensagem);
    this.name = 'DatajudError';
  }
}

export interface DatajudHit {
  _id: string;
  _index: string;
  _source: DatajudProcessData;
  sort?: unknown[];
}

export interface DatajudSearchResult {
  hits: DatajudHit[];
  total: number;
  took: number;
}

export interface DatajudClientOptions {
  /** Chave já resolvida (ver resolverChave). Sem chave, toda chamada lança `sem_chave`. */
  apiKey: string | null;
  /** Injetável nos testes. */
  fetchFn?: typeof fetch;
  /** Intervalo mínimo entre requisições, compartilhado por processo Node. */
  minIntervalMs?: number;
  timeoutMs?: number;
  maxTentativas?: number;
}

// Limitador global: a API pública não documenta limite, mas é um serviço
// compartilhado do CNJ. 2 req/s foi o ritmo usado nos testes sem nenhum 429.
let proximaLiberacao = 0;
async function aguardarVez(minIntervalMs: number) {
  const agora = Date.now();
  const inicio = Math.max(agora, proximaLiberacao);
  proximaLiberacao = inicio + minIntervalMs;
  if (inicio > agora) await new Promise((r) => setTimeout(r, inicio - agora));
}

const CAMPOS_INSTANCIA = [
  'id',
  'numeroProcesso',
  'tribunal',
  'grau',
  'classe',
  'sistema',
  'formato',
  'dataAjuizamento',
  'nivelSigilo',
  'orgaoJulgador',
  'assuntos',
  'dataHoraUltimaAtualizacao',
  '@timestamp',
  'movimentos',
];

export class DatajudClient {
  private readonly apiKey: string | null;
  private readonly fetchFn: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly maxTentativas: number;

  constructor(opts: DatajudClientOptions) {
    this.apiKey = opts.apiKey;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.minIntervalMs = opts.minIntervalMs ?? 500;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.maxTentativas = opts.maxTentativas ?? 3;
  }

  /** `_search` cru no índice, com limitador, timeout e retentativa em 429/5xx/rede. */
  async search(alias: string, body: Record<string, unknown>): Promise<DatajudSearchResult> {
    if (!this.apiKey) {
      throw new DatajudError('sem_chave', 'Nenhuma chave do Datajud configurada (firma ou DATAJUD_API_KEY).');
    }
    const auth = this.apiKey.startsWith('APIKey ') ? this.apiKey : `APIKey ${this.apiKey}`;

    let ultimoErro: unknown;
    for (let tentativa = 1; tentativa <= this.maxTentativas; tentativa++) {
      await aguardarVez(this.minIntervalMs);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchFn(`${BASE_URL}/${alias}/_search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (res.status === 401 || res.status === 403) {
          throw new DatajudError('chave_invalida', 'O Datajud recusou a chave de API.', res.status);
        }
        if (res.status === 404) {
          throw new DatajudError('http', `Índice ${alias} não existe no Datajud.`, 404);
        }
        if (res.status === 429 || res.status >= 500) {
          ultimoErro = new DatajudError('http', `Datajud respondeu ${res.status}.`, res.status);
          await this.recuar(tentativa);
          continue;
        }
        if (!res.ok) {
          const corpo = (await res.json().catch(() => ({}))) as { error?: { reason?: string } };
          throw new DatajudError('http', corpo.error?.reason ?? `Datajud respondeu ${res.status}.`, res.status);
        }

        const json = (await res.json()) as {
          took: number;
          hits: { total: { value: number }; hits: DatajudHit[] };
        };
        return { hits: json.hits.hits, total: json.hits.total.value, took: json.took };
      } catch (err) {
        if (err instanceof DatajudError) throw err;
        // AbortError, DNS, reset: vale retentar.
        ultimoErro = new DatajudError('rede', `Falha de rede ao consultar o Datajud: ${(err as Error).message}`);
        await this.recuar(tentativa);
      } finally {
        clearTimeout(timer);
      }
    }
    throw ultimoErro instanceof Error ? ultimoErro : new DatajudError('rede', 'Datajud indisponível.');
  }

  private async recuar(tentativa: number) {
    if (tentativa >= this.maxTentativas) return;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (tentativa - 1)));
  }

  /**
   * Todas as instâncias (G1, G2, JE, TR…) de um processo, ordenadas da origem
   * para a mais alta. Os movimentos vêm como o Datajud manda (sem ordem).
   */
  async buscarPorNumero(numero: string): Promise<DatajudHit[]> {
    const digitos = somenteDigitos(numero);
    const alias = aliasDatajud(digitos);
    const { hits } = await this.search(alias, {
      size: 10,
      query: { match: { numeroProcesso: digitos } },
      _source: CAMPOS_INSTANCIA,
    });
    return ordenarInstancias(hits.filter((h) => h._source.numeroProcesso === digitos));
  }

  /**
   * Lote: um único `terms` para até ~200 números do mesmo índice. Devolve os
   * documentos agrupados por número; números ausentes não aparecem no mapa.
   */
  async buscarVarios(alias: string, numeros: string[]): Promise<Map<string, DatajudHit[]>> {
    const digitos = numeros.map(somenteDigitos);
    const porNumero = new Map<string, DatajudHit[]>();
    if (digitos.length === 0) return porNumero;
    const { hits } = await this.search(alias, {
      size: Math.min(10_000, digitos.length * 6),
      query: { terms: { numeroProcesso: digitos } },
      _source: CAMPOS_INSTANCIA,
    });
    for (const h of hits) {
      const lista = porNumero.get(h._source.numeroProcesso) ?? [];
      lista.push(h);
      porNumero.set(h._source.numeroProcesso, lista);
    }
    for (const [n, lista] of porNumero) porNumero.set(n, ordenarInstancias(lista));
    return porNumero;
  }

  /**
   * Documentos atualizados desde `desde`, página a página via `search_after`
   * (o `from` do Elasticsearch trava em 10.000). Usado pela sincronização em
   * lote da fase 2.
   */
  async *buscarAtualizadosDesde(
    alias: string,
    desde: Date,
    opts: { tamanhoPagina?: number; orgaoJulgadorCodigo?: number } = {},
  ): AsyncGenerator<DatajudHit[]> {
    const filtros: Record<string, unknown>[] = [
      { range: { dataHoraUltimaAtualizacao: { gte: desde.toISOString() } } },
    ];
    if (opts.orgaoJulgadorCodigo) filtros.push({ term: { 'orgaoJulgador.codigo': opts.orgaoJulgadorCodigo } });

    let searchAfter: unknown[] | undefined;
    while (true) {
      const { hits } = await this.search(alias, {
        size: opts.tamanhoPagina ?? 1000,
        query: { bool: { filter: filtros } },
        sort: [{ '@timestamp': 'asc' }],
        _source: CAMPOS_INSTANCIA,
        ...(searchAfter ? { search_after: searchAfter } : {}),
      });
      if (hits.length === 0) return;
      yield hits;
      searchAfter = hits[hits.length - 1].sort;
      if (!searchAfter) return;
    }
  }

  /** Checagem barata para a tela de configurações: `size:0` num índice pequeno. */
  async verificarChave(): Promise<'ok' | 'sem_chave' | 'chave_invalida' | 'indisponivel'> {
    try {
      await this.search('api_publica_tjmrs', { size: 0 });
      return 'ok';
    } catch (err) {
      if (err instanceof DatajudError) {
        if (err.tipo === 'sem_chave') return 'sem_chave';
        if (err.tipo === 'chave_invalida') return 'chave_invalida';
      }
      return 'indisponivel';
    }
  }
}
