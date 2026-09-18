/**
 * Numeração única do CNJ (Res. CNJ 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO
 *
 *   NNNNNNN  sequencial no órgão de origem
 *   DD       dígitos verificadores (módulo 97, ISO 7064)
 *   AAAA     ano do ajuizamento
 *   J        segmento da justiça (1 STF … 9 Justiça Militar Estadual)
 *   TR       tribunal dentro do segmento (região, UF ou 00 para superiores)
 *   OOOO     unidade de origem (vara, comarca, subseção)
 */

export function somenteDigitos(numero: string): string {
  return numero.replace(/\D/g, '');
}

/** `50192100820214047100` → `5019210-08.2021.4.04.7100`. Devolve a entrada se não tiver 20 dígitos. */
export function formatarNumeroCnj(numero: string): string {
  const d = somenteDigitos(numero);
  if (d.length !== 20) return numero;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

export interface PartesCnj {
  sequencial: string;
  digitos: string;
  ano: string;
  justica: string;
  tribunal: string;
  origem: string;
}

export function decomporNumeroCnj(numero: string): PartesCnj | null {
  const d = somenteDigitos(numero);
  if (d.length !== 20) return null;
  return {
    sequencial: d.slice(0, 7),
    digitos: d.slice(7, 9),
    ano: d.slice(9, 13),
    justica: d.slice(13, 14),
    tribunal: d.slice(14, 16),
    origem: d.slice(16, 20),
  };
}

/** DD = 98 − ((NNNNNNN AAAA J TR OOOO × 100) mod 97). */
export function calcularDigitosCnj(p: Omit<PartesCnj, 'digitos'>): string {
  const base = BigInt(`${p.sequencial}${p.ano}${p.justica}${p.tribunal}${p.origem}00`);
  const dd = 98n - (base % 97n);
  return dd.toString().padStart(2, '0');
}

export function validarNumeroCnj(numero: string): boolean {
  const p = decomporNumeroCnj(numero);
  if (!p) return false;
  return calcularDigitosCnj(p) === p.digitos;
}

const UF_POR_TR: Record<string, string> = {
  '01': 'ac', '02': 'al', '03': 'ap', '04': 'am', '05': 'ba', '06': 'ce', '07': 'dft',
  '08': 'es', '09': 'go', '10': 'ma', '11': 'mt', '12': 'ms', '13': 'mg', '14': 'pa',
  '15': 'pb', '16': 'pr', '17': 'pe', '18': 'pi', '19': 'rj', '20': 'rn', '21': 'rs',
  '22': 'ro', '23': 'rr', '24': 'sc', '25': 'se', '26': 'sp', '27': 'to',
};

/** Tribunais de Justiça Militar estaduais existem só em MG, RS e SP. */
const TJM_POR_TR: Record<string, string> = { '13': 'tjmmg', '21': 'tjmrs', '26': 'tjmsp' };

export class NumeroCnjInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'NumeroCnjInvalidoError';
  }
}

/**
 * Índice do Datajud que guarda o processo. Lança em vez de "chutar": um alias
 * errado devolve zero resultados em silêncio e o processo parece inexistente.
 * Aliases verificados com `size:0` em 2026-09-18 (ver docs/INTEGRACAO_TRIBUNAIS_INSS.md).
 */
export function aliasDatajud(numero: string): string {
  const p = decomporNumeroCnj(numero);
  if (!p) throw new NumeroCnjInvalidoError('Número CNJ inválido: precisa ter 20 dígitos.');
  const { justica: j, tribunal: tr } = p;
  const n = parseInt(tr, 10);

  switch (j) {
    case '1':
    case '2':
      // Verificado 2026-09-18: api_publica_stf e api_publica_cnj respondem 404.
      throw new NumeroCnjInvalidoError('STF e CNJ (segmentos 1 e 2) não têm índice público no Datajud.');
    case '3':
      return 'api_publica_stj';
    case '4':
      if (n >= 1 && n <= 6) return `api_publica_trf${n}`;
      throw new NumeroCnjInvalidoError(`TRF ${tr} não existe (esperado 01 a 06).`);
    case '5':
      if (n === 0) return 'api_publica_tst';
      if (n >= 1 && n <= 24) return `api_publica_trt${n}`;
      throw new NumeroCnjInvalidoError(`TRT ${tr} não existe (esperado 01 a 24).`);
    case '6': {
      if (n === 0) return 'api_publica_tse';
      const uf = UF_POR_TR[tr];
      if (!uf) throw new NumeroCnjInvalidoError(`TRE com código ${tr} não existe.`);
      return `api_publica_tre-${uf === 'dft' ? 'df' : uf}`;
    }
    case '7':
      return 'api_publica_stm';
    case '8': {
      const uf = UF_POR_TR[tr];
      if (!uf) throw new NumeroCnjInvalidoError(`Tribunal de Justiça com código ${tr} não existe.`);
      return `api_publica_tj${uf}`;
    }
    case '9': {
      const alias = TJM_POR_TR[tr];
      if (!alias) throw new NumeroCnjInvalidoError(`Justiça Militar Estadual só existe em MG, RS e SP (recebido ${tr}).`);
      return `api_publica_${alias}`;
    }
    default:
      throw new NumeroCnjInvalidoError(`Segmento de justiça desconhecido: ${j}.`);
  }
}
