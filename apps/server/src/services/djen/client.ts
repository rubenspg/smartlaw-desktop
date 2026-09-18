import type { DjenItem, DjenResposta } from './types';

const BASE_URL = 'https://comunicaapi.pje.jus.br';

export type TipoErroDjen = 'geobloqueado' | 'http' | 'rede' | 'config';

export class DjenError extends Error {
  constructor(
    public readonly tipo: TipoErroDjen,
    mensagem: string,
    public readonly status?: number,
  ) {
    super(mensagem);
    this.name = 'DjenError';
  }
}

/**
 * `direct`: chama comunicaapi.pje.jus.br diretamente. É o padrão porque a API
 * de produção (LXC 103) sai pelo túnel NordVPN Brasil do roteador — ver
 * docs/INTEGRACAO_TRIBUNAIS_INSS.md §5. `relay`: repassa o mesmo caminho a um
 * proxy no Brasil (`BR_RELAY_URL`), só se aquele arranjo deixar de existir.
 */
export type DjenTransporte = 'direct' | 'relay';

export interface DjenClientOptions {
  transporte?: DjenTransporte;
  relayUrl?: string | null;
  relayToken?: string | null;
  /** Injetável nos testes. */
  fetchFn?: typeof fetch;
  /** Intervalo mínimo entre requisições (a API não tem auth nem limite documentado; 500 ms foi o ritmo verificado). */
  minIntervalMs?: number;
  timeoutMs?: number;
  maxTentativas?: number;
  /** 100–200 é o que a verificação recomendou; até 1000 funciona. */
  itensPorPagina?: number;
  /** Trava de segurança para a paginação, que ignora `count`. */
  maxPaginas?: number;
}

export interface FiltroDjen {
  /** `yyyy-mm-dd`, inclusive. */
  inicio?: string;
  fim?: string;
  siglaTribunal?: string;
}

export interface OabConsulta {
  numero: string;
  uf: string;
}

export type AcessoDjen = 'ok' | 'geobloqueado' | 'indisponivel';

// Limitador global próprio (o do Datajud é outro serviço, outro ritmo).
let proximaLiberacao = 0;
async function aguardarVez(minIntervalMs: number) {
  const agora = Date.now();
  const inicio = Math.max(agora, proximaLiberacao);
  proximaLiberacao = inicio + minIntervalMs;
  if (inicio > agora) await new Promise((r) => setTimeout(r, inicio - agora));
}

export class DjenClient {
  private readonly transporte: DjenTransporte;
  private readonly baseUrl: string;
  private readonly relayToken: string | null;
  private readonly fetchFn: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly maxTentativas: number;
  readonly itensPorPagina: number;
  private readonly maxPaginas: number;

  constructor(opts: DjenClientOptions = {}) {
    this.transporte = opts.transporte ?? 'direct';
    if (this.transporte === 'relay') {
      if (!opts.relayUrl) throw new DjenError('config', 'DJEN_TRANSPORT=relay exige BR_RELAY_URL.');
      this.baseUrl = opts.relayUrl.replace(/\/+$/, '');
    } else {
      this.baseUrl = BASE_URL;
    }
    this.relayToken = opts.relayToken ?? null;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.minIntervalMs = opts.minIntervalMs ?? 500;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.maxTentativas = opts.maxTentativas ?? 3;
    this.itensPorPagina = opts.itensPorPagina ?? 100;
    this.maxPaginas = opts.maxPaginas ?? 200;
  }

  /**
   * GET com limitador, timeout e retentativa em 429/5xx/rede. `403` é o
   * CloudFront recusando IP fora do Brasil: não retenta e sobe como
   * `geobloqueado` — na produção significa que o túnel do roteador caiu.
   */
  private async get(path: string, params: Record<string, string | number | undefined> = {}): Promise<Response> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { Accept: 'application/json, application/pdf' };
    if (this.transporte === 'relay' && this.relayToken) headers.Authorization = `Bearer ${this.relayToken}`;

    let ultimoErro: unknown;
    for (let tentativa = 1; tentativa <= this.maxTentativas; tentativa++) {
      await aguardarVez(this.minIntervalMs);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchFn(url, { method: 'GET', headers, signal: controller.signal });
        if (res.status === 403) {
          throw new DjenError(
            'geobloqueado',
            'O DJEN recusou a requisição (403): o chamador não está saindo por um IP brasileiro.',
            403,
          );
        }
        if (res.status === 429 || res.status >= 500) {
          ultimoErro = new DjenError('http', `DJEN respondeu ${res.status}.`, res.status);
          await this.recuar(tentativa);
          continue;
        }
        return res;
      } catch (err) {
        if (err instanceof DjenError) throw err;
        ultimoErro = new DjenError('rede', `Falha de rede ao consultar o DJEN: ${(err as Error).message}`);
        await this.recuar(tentativa);
      } finally {
        clearTimeout(timer);
      }
    }
    throw ultimoErro instanceof Error ? ultimoErro : new DjenError('rede', 'DJEN indisponível.');
  }

  private async recuar(tentativa: number) {
    if (tentativa >= this.maxTentativas) return;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (tentativa - 1)));
  }

  private async lerJson(res: Response): Promise<DjenResposta> {
    if (!res.ok) throw new DjenError('http', `DJEN respondeu ${res.status}.`, res.status);
    const json = (await res.json()) as Partial<DjenResposta>;
    return { status: json.status ?? 'success', message: json.message, count: json.count, items: json.items ?? [] };
  }

  /**
   * Percorre `pagina` 1, 2, 3… até uma página vir menor que `itensPorPagina`.
   * `count` é ignorado de propósito (vem errado com páginas ≥ 200). As páginas
   * chegam da mais recente para a mais antiga.
   */
  async *paginar(params: Record<string, string | number | undefined>): AsyncGenerator<DjenItem[]> {
    for (let pagina = 1; pagina <= this.maxPaginas; pagina++) {
      const res = await this.get('/api/v1/comunicacao', {
        ...params,
        pagina,
        itensPorPagina: this.itensPorPagina,
      });
      const { items } = await this.lerJson(res);
      if (items.length === 0) return;
      yield items;
      if (items.length < this.itensPorPagina) return;
    }
  }

  /** Comunicações endereçadas a um advogado. A API normaliza o número (`57689` ≡ `RS057689`). */
  listarPorOab(oab: OabConsulta, filtro: FiltroDjen = {}): AsyncGenerator<DjenItem[]> {
    return this.paginar({
      numeroOab: oab.numero,
      ufOab: oab.uf.toUpperCase(),
      dataDisponibilizacaoInicio: filtro.inicio,
      dataDisponibilizacaoFim: filtro.fim,
      siglaTribunal: filtro.siglaTribunal,
    });
  }

  /** Comunicações de um processo (20 dígitos ou com máscara, ambos aceitos). */
  listarPorProcesso(numero: string, filtro: FiltroDjen = {}): AsyncGenerator<DjenItem[]> {
    return this.paginar({
      numeroProcesso: numero,
      dataDisponibilizacaoInicio: filtro.inicio,
      dataDisponibilizacaoFim: filtro.fim,
      siglaTribunal: filtro.siglaTribunal,
    });
  }

  /** Conveniência: todas as páginas de uma OAB numa lista. */
  async coletarPorOab(oab: OabConsulta, filtro: FiltroDjen = {}): Promise<DjenItem[]> {
    const tudo: DjenItem[] = [];
    for await (const pagina of this.listarPorOab(oab, filtro)) tudo.push(...pagina);
    return tudo;
  }

  async obter(id: number): Promise<DjenItem | null> {
    const res = await this.get(`/api/v1/comunicacao/${id}`);
    if (res.status === 404) return null;
    const { items } = await this.lerJson(res);
    return items[0] ?? null;
  }

  /** Certidão da comunicação em PDF (≈60 KB), para anexar à pasta do processo. */
  async certidao(hash: string): Promise<Uint8Array> {
    const res = await this.get(`/api/v1/comunicacao/${encodeURIComponent(hash)}/certidao`);
    if (!res.ok) throw new DjenError('http', `DJEN respondeu ${res.status} para a certidão.`, res.status);
    return new Uint8Array(await res.arrayBuffer());
  }

  /** Checagem barata para a tela de configurações e para o job antes de uma rodada. */
  async verificarAcesso(): Promise<AcessoDjen> {
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const res = await this.get('/api/v1/comunicacao', {
        siglaTribunal: 'TRF4',
        dataDisponibilizacaoInicio: hoje,
        dataDisponibilizacaoFim: hoje,
        pagina: 1,
        itensPorPagina: 1,
      });
      await this.lerJson(res);
      return 'ok';
    } catch (err) {
      if (err instanceof DjenError && err.tipo === 'geobloqueado') return 'geobloqueado';
      return 'indisponivel';
    }
  }
}
