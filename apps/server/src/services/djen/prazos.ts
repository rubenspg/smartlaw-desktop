import type { Feriado } from '../../db/schema';

/**
 * Contagem de prazos processuais em dias úteis a partir da disponibilização
 * no DJEN.
 *
 * Regras (Lei 11.419/2006 art. 4º §§3º-4º, CPC arts. 219, 220 e 224, Res. CNJ
 * 455/2022): a publicação é o primeiro dia útil seguinte à disponibilização;
 * o prazo começa a correr no primeiro dia útil seguinte à publicação; contam-se
 * só dias úteis; de 20/12 a 20/01 os prazos ficam suspensos (recesso forense).
 *
 * O calendário embutido é deliberadamente o mínimo que todo tribunal observa
 * (fins de semana, feriados nacionais, Carnaval, Sexta-feira Santa, Corpus
 * Christi, recesso). Um feriado a menos deixa o termo final calculado ANTES do
 * real — nunca depois — então errar para esse lado é seguro. Feriados locais
 * entram por `firms.feriados` e adiam o termo; só cadastre os que o tribunal
 * da firma de fato observa.
 *
 * Todas as datas são "só data" (`yyyy-mm-dd`) manipuladas como meia-noite UTC
 * para a aritmética não depender do fuso da máquina.
 */

export type DataISO = string;

export function paraData(iso: DataISO): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new Error(`Data inválida: ${iso}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export function paraISO(d: Date): DataISO {
  return d.toISOString().slice(0, 10);
}

function somarDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** `yyyy-mm-dd` → nome, só os feriados que todo tribunal brasileiro observa. */
export function feriadosNacionais(ano: number): Map<DataISO, string> {
  const fixos: Array<[string, string]> = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['12-25', 'Natal'],
  ];
  // Lei 14.759/2023: feriado nacional a partir de 2024.
  if (ano >= 2024) fixos.push(['11-20', 'Dia Nacional de Zumbi e da Consciência Negra']);

  const mapa = new Map<DataISO, string>();
  for (const [md, nome] of fixos) mapa.set(`${ano}-${md}`, nome);
  const domingo = pascoa(ano);
  mapa.set(paraISO(somarDias(domingo, -48)), 'Segunda-feira de Carnaval');
  mapa.set(paraISO(somarDias(domingo, -47)), 'Terça-feira de Carnaval');
  mapa.set(paraISO(somarDias(domingo, -2)), 'Sexta-feira Santa');
  mapa.set(paraISO(somarDias(domingo, 60)), 'Corpus Christi');
  return mapa;
}

/** CPC art. 220: prazos suspensos de 20/12 a 20/01, inclusive. */
export function emRecesso(d: Date): boolean {
  const mes = d.getUTCMonth() + 1;
  const dia = d.getUTCDate();
  return (mes === 12 && dia >= 20) || (mes === 1 && dia <= 20);
}

export interface CalendarioOpts {
  /** Feriados locais da firma (`MM-DD` todo ano, ou `YYYY-MM-DD`). */
  feriados?: Feriado[] | null;
}

/** Por que um dia não conta, ou null se é dia útil. */
export function motivoNaoUtil(d: Date, opts: CalendarioOpts = {}): string | null {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return 'fim de semana';
  if (emRecesso(d)) return 'recesso forense (CPC art. 220)';
  const iso = paraISO(d);
  const nacional = feriadosNacionais(d.getUTCFullYear()).get(iso);
  if (nacional) return nacional;
  for (const f of opts.feriados ?? []) {
    if (f.data === iso || (f.data.length === 5 && iso.endsWith(`-${f.data}`))) return f.nome;
  }
  return null;
}

export function ehDiaUtil(d: Date, opts: CalendarioOpts = {}): boolean {
  return motivoNaoUtil(d, opts) === null;
}

/** Primeiro dia útil estritamente depois de `d`. */
export function proximoDiaUtil(d: Date, opts: CalendarioOpts = {}): Date {
  let atual = somarDias(d, 1);
  while (!ehDiaUtil(atual, opts)) atual = somarDias(atual, 1);
  return atual;
}

/**
 * O n-ésimo dia útil contando `inicio` como o primeiro (se `inicio` não for
 * útil, o primeiro é o dia útil seguinte). `n` ≥ 1.
 */
export function somarDiasUteis(inicio: Date, n: number, opts: CalendarioOpts = {}): Date {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Quantidade de dias úteis inválida: ${n}`);
  let atual = ehDiaUtil(inicio, opts) ? inicio : proximoDiaUtil(inicio, opts);
  for (let contados = 1; contados < n; contados++) atual = proximoDiaUtil(atual, opts);
  return atual;
}

export interface Prazo {
  /** Data da publicação: primeiro dia útil após a disponibilização. */
  publicacao: DataISO;
  /** Dia 1 da contagem: primeiro dia útil após a publicação. */
  inicio: DataISO;
  /** Termo final (dia `dias` da contagem). */
  fim: DataISO;
  dias: number;
}

export function calcularPrazo(disponibilizacao: DataISO, dias: number, opts: CalendarioOpts = {}): Prazo {
  const disp = paraData(disponibilizacao);
  const publicacao = proximoDiaUtil(disp, opts);
  const inicio = proximoDiaUtil(publicacao, opts);
  const fim = somarDiasUteis(inicio, dias, opts);
  return { publicacao: paraISO(publicacao), inicio: paraISO(inicio), fim: paraISO(fim), dias };
}

/**
 * 23:59:59 de Brasília do dia dado. O Brasil não tem horário de verão desde
 * 2019, então o deslocamento é fixo em -03:00.
 */
export function fimDoDiaBrasil(iso: DataISO): Date {
  return new Date(`${iso}T23:59:59-03:00`);
}
