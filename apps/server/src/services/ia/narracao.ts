/**
 * Base dos textos escritos pelo modelo: formatadores, leitura da resposta e a
 * conferência de números.
 *
 * A regra é que o código calcula todo número e o modelo só narra. O payload
 * leva strings já formatadas em pt-BR ("1.590", "+12,5%"), e
 * `numerosNaoSuportados` recusa a resposta que citar um número ausente dele.
 * Puro, testado em narracao.test.ts.
 */

/** "1.234" ou "8,5": o mesmo formatador nos cards, no texto calculado e no payload. */
export function formatarNumero(valor: number, casas = 0): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** "+12,5%"; null quando não há base de comparação. */
export function formatarPct(valor: number | null, comSinal = true, casas = 1): string | null {
  if (valor == null || !Number.isFinite(valor)) return null;
  const sinal = comSinal && valor > 0 ? '+' : '';
  return `${sinal}${formatarNumero(valor, casas)}%`;
}

/** Regras de números que toda instrução inclui, para a conferência poder valer. */
export const REGRAS_NUMEROS = `- Use só números que aparecem no JSON, copiados exatamente como estão (mesmas casas decimais, vírgula e ponto). Nunca arredonde, abrevie ("mil", "k"), some, subtraia ou calcule um número novo. Se precisar de um número que não está lá, descreva em palavras.
- Escreva números como algarismos, no formato do JSON. Omita o "+" ou "-" quando o verbo já dá a direção ("subiu 12,5%", não "subiu +12,5%").`;

export interface Narracao {
  resumo: string;
  pontos: { titulo: string; detalhe: string }[];
}

/** Lê o JSON da resposta; null quando não tem o formato pedido. */
export function lerNarracao(bruto: string): Narracao | null {
  const texto = bruto
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    const json = JSON.parse(texto);
    if (typeof json?.resumo !== 'string' || !json.resumo.trim()) return null;
    const pontos = Array.isArray(json.pontos)
      ? json.pontos
          .filter((p: unknown): p is Narracao['pontos'][number] => {
            const q = p as Record<string, unknown> | null;
            return typeof q?.titulo === 'string' && typeof q?.detalhe === 'string';
          })
          .slice(0, 3)
      : [];
    return { resumo: json.resumo.trim(), pontos };
  } catch {
    return null;
  }
}

/** Todo o texto de uma narração, como a conferência o lê. */
export function textoDaNarracao(n: Narracao): string {
  return [n.resumo, ...n.pontos.flatMap((p) => [p.titulo, p.detalhe])].join('\n');
}

// Datas (20/10, 20/10/2026, 2026-10-20) não são números do resumo: saem antes.
const DATA = /(?<!\d)(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(?!\d)/g;

// Identificadores contam como um bloco, não como algarismos soltos: o CNJ
// 0001234-56.2024.8.26.0100 viraria "0001234", "56" e "2024", e "2024" passaria
// por acaso. Nenhum deve aparecer: o payload não leva CNJ nem OAB.
const IDENTIFICADORES = [
  /(?<!\d)\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}(?!\d)/g, // CNJ, com ou sem máscara
  /\bOAB\s*\/?\s*[A-Z]{2}\s*[\d.]+/gi,
  /(?<![\d.])\d{1,3}(?:\.?\d{3})\s*\/\s*[A-Z]{2}\b/g, // 123.456/SP
];

// Um bloco de algarismos, pontos e vírgulas que começa e termina em algarismo,
// sem letra colada (G1, 1ª, 3x): esses são rótulos, não números.
const BLOCO = /(?<![\p{L}\d.,])\d(?:[\d.,]*\d)?(?![\p{L}\d])/gu;
const PT_BR = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/;
const ABREVIADO = /^\s*(mil|milh[õo]es|milh[ãa]o|bi|k)(?!\p{L})/iu;

/**
 * Lê os números de um texto pt-BR. "1.590,64" vira "1590.64" e "12,5" vira
 * "12.5". Um bloco fora do padrão pt-BR ("12.5", "1,590.64") ou abreviado
 * ("12 mil") vai para `invalidos`, que nunca casam com o payload.
 */
function lerNumeros(texto: string): { numeros: string[]; identificadores: string[]; invalidos: string[] } {
  let limpo = texto.replace(DATA, ' ');
  const identificadores: string[] = [];
  for (const re of IDENTIFICADORES) {
    limpo = limpo.replace(re, (m) => {
      identificadores.push(m.replace(/\s+/g, ' ').toUpperCase());
      return ' ';
    });
  }
  const numeros: string[] = [];
  const invalidos: string[] = [];
  for (const m of limpo.matchAll(BLOCO)) {
    const bloco = m[0];
    const abreviado = limpo.slice((m.index ?? 0) + bloco.length).match(ABREVIADO);
    if (abreviado) invalidos.push(`${bloco} ${abreviado[1]}`);
    else if (PT_BR.test(bloco)) numeros.push(String(Number(bloco.replace(/\./g, '').replace(',', '.'))));
    else invalidos.push(bloco);
  }
  return { numeros, identificadores, invalidos };
}

/**
 * Números (e identificadores) de `texto` que não aparecem em `payload`. A
 * comparação é pelo valor: "+12,5%" casa com "12,5%", mas "12%" não casa com
 * "12,5%". Um número arredondado continua sendo um número inventado.
 */
export function numerosNaoSuportados(texto: string, payload: unknown): string[] {
  const doPayload = lerNumeros(JSON.stringify(payload));
  const permitidos = new Set([...doPayload.numeros, ...doPayload.identificadores]);
  const doTexto = lerNumeros(texto);
  const fora = [...doTexto.numeros, ...doTexto.identificadores].filter((n) => !permitidos.has(n));
  return [...new Set([...fora, ...doTexto.invalidos])];
}
