import type { IntimacaoAdvogado, IntimacaoDestinatario } from '../../db/schema';
import { somenteDigitos } from '../datajud/cnj';
import type { DjenItem } from './types';

/**
 * `RS062492` / `062492` / `62492` → `62492`. Sufixos de inscrição (`99221A`)
 * ficam. A API já normaliza na consulta, mas nos itens o número volta de
 * qualquer jeito, então toda comparação local passa por aqui.
 */
export function normalizarOab(numero: string | null | undefined): string {
  const bruto = (numero ?? '').trim().toUpperCase().replace(/[.\s-]/g, '');
  const m = /^[A-Z]{0,2}0*(\d+[A-Z]?)$/.exec(bruto);
  return m ? m[1] : bruto;
}

/** Chave para conjuntos: `RS:62492`. */
export function chaveOab(numero: string, uf: string): string {
  return `${uf.trim().toUpperCase()}:${normalizarOab(numero)}`;
}

/** Advogados destinatários do item, com OAB normalizada e sem repetidos. */
export function advogadosDoItem(item: DjenItem): IntimacaoAdvogado[] {
  const vistos = new Set<string>();
  const lista: IntimacaoAdvogado[] = [];
  for (const d of item.destinatarioadvogados ?? []) {
    const a = d?.advogado;
    if (!a?.numero_oab) continue;
    const numero = normalizarOab(a.numero_oab);
    const uf = (a.uf_oab ?? '').trim().toUpperCase();
    const chave = `${uf}:${numero}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push({ nome: (a.nome ?? '').trim(), numero, uf });
  }
  return lista;
}

export function destinatariosDoItem(item: DjenItem): IntimacaoDestinatario[] {
  return (item.destinatarios ?? [])
    .filter((d) => d?.nome)
    .map((d) => ({ nome: d.nome.trim(), polo: d.polo ?? null }));
}

/** Os dois sócios recebem 99% dos itens em comum: uma consulta por OAB, um item por id. */
export function dedupePorId(items: DjenItem[]): DjenItem[] {
  const porId = new Map<number, DjenItem>();
  for (const it of items) if (!porId.has(it.id)) porId.set(it.id, it);
  return [...porId.values()];
}

/**
 * Comunicações que não abrem prazo: são guardadas e exibidas, mas não viram
 * tarefa. `Edital` não entra porque um edital de citação abre prazo.
 */
export const TIPOS_INFORMATIVOS = new Set(['Lista de distribuição', 'Pauta de julgamento', 'Ata de sessão']);

export function ehInformativa(item: Pick<DjenItem, 'tipoComunicacao'>): boolean {
  return TIPOS_INFORMATIVOS.has((item.tipoComunicacao ?? '').trim());
}

export interface RegraPrazo {
  dias: number;
  /** Fundamento, para o advogado conferir na tarefa. */
  motivo: string;
}

const ehJuizado = (item: Pick<DjenItem, 'nomeClasse'>) => /JUIZADO/i.test(item.nomeClasse ?? '');

/**
 * Prazo sugerido em dias úteis. É uma sugestão conservadora — nunca maior que
 * o prazo legal do caso comum — que o advogado ajusta na tarefa; a fase 6 (IA)
 * vai propor a partir do texto do ato.
 *
 * Difere do plano num ponto: Citação recebe 15 (CPC art. 335) e não 30. O 30
 * vale para a Fazenda (art. 183), que não é o cliente da firma; sugerir prazo
 * maior que o real é o único erro que este cálculo não pode cometer.
 */
export function prazoSugerido(
  item: Pick<DjenItem, 'tipoComunicacao' | 'tipoDocumento' | 'nomeClasse'>,
): RegraPrazo | null {
  if (ehInformativa(item)) return null;
  const tipoCom = (item.tipoComunicacao ?? '').trim();
  const tipoDoc = (item.tipoDocumento ?? '').trim().toUpperCase();

  if (tipoCom === 'Citação') return { dias: 15, motivo: 'Citação — contestação em 15 dias úteis (CPC art. 335)' };
  if (tipoDoc === 'SENTENÇA' || tipoDoc === 'ACÓRDÃO') {
    if (ehJuizado(item)) {
      return { dias: 10, motivo: `${item.tipoDocumento} em juizado — recurso em 10 dias (Lei 9.099 art. 42; Lei 10.259 art. 5º)` };
    }
    return { dias: 15, motivo: `${item.tipoDocumento} — recurso em 15 dias úteis (CPC art. 1.003 §5º)` };
  }
  if (tipoDoc === 'ATO ORDINATÓRIO' || tipoDoc === 'DESPACHO/DECISÃO') {
    return { dias: 5, motivo: `${item.tipoDocumento} — 5 dias úteis quando o ato não fixa prazo (CPC art. 218 §3º)` };
  }
  return { dias: 15, motivo: `${tipoCom} — prazo padrão de 15 dias úteis; confira no texto do ato` };
}

// Entidades HTML da Latin-1 (nomes na ordem dos pontos de código 160–255) — o
// eproc manda `&Ccedil;`, `&atilde;`, `&nbsp;` etc. sem declarar charset.
const NOMES_LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest ' +
  'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig ' +
  'agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml';
const ENTIDADES = new Map<string, string>([
  ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"],
  ['ndash', '–'], ['mdash', '—'], ['lsquo', '‘'], ['rsquo', '’'], ['ldquo', '“'], ['rdquo', '”'], ['hellip', '…'], ['bull', '•'],
  ...NOMES_LATIN1.split(' ').map((nome, i): [string, string] => [nome, String.fromCharCode(160 + i)]),
]);

function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (tudo, corpo: string) => {
    if (corpo[0] === '#') {
      const cod = corpo[1].toLowerCase() === 'x' ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
      return Number.isFinite(cod) && cod > 0 && cod < 0x110000 ? String.fromCodePoint(cod) : tudo;
    }
    return ENTIDADES.get(corpo) ?? tudo;
  });
}

/**
 * HTML do ato → texto corrido para busca, resumo e a tarefa. Remove
 * `<style>`/`<script>`/`<head>`, preserva quebras de bloco e desfaz entidades.
 */
export function textoPlano(html: string | null | undefined): string {
  if (!html) return '';
  const semBlocos = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(style|script|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|tr|h[1-6]|section|article|header|footer|blockquote|table|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const texto = decodificarEntidades(semBlocos).replace(/\u00a0/g, ' ');
  return texto
    .split('\n')
    .map((l) => l.replace(/[ \t\r\f\v]+/g, ' ').trim())
    .join('\n')
    // O HTML do eproc é uma pilha de divs vazias: linhas em branco não dizem nada.
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Número CNJ com máscara para títulos; cai para o bruto se não tiver 20 dígitos. */
export function numeroExibicao(item: Pick<DjenItem, 'numero_processo' | 'numeroprocessocommascara'>): string {
  const mascara = item.numeroprocessocommascara?.trim();
  if (mascara) return mascara;
  const d = somenteDigitos(item.numero_processo ?? '');
  return d.length === 20 ? `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d[13]}.${d.slice(14, 16)}.${d.slice(16)}` : item.numero_processo;
}

export function tituloTarefa(item: DjenItem): string {
  const tipo = item.tipoDocumento?.trim() || item.tipoComunicacao;
  return `${item.tipoComunicacao} — ${tipo} — ${numeroExibicao(item)}`;
}

/** Primeiras linhas do ato, para a descrição da tarefa. */
export function resumoTexto(plano: string, max = 600): string {
  const compacto = plano.replace(/\s*\n\s*/g, ' · ').replace(/\s+/g, ' ').trim();
  return compacto.length <= max ? compacto : compacto.slice(0, max - 1).trimEnd() + '…';
}
