import type { Feriado } from '../../db/schema';
import { feriadosNacionais, fimDoDiaBrasil, paraData, paraISO } from '../djen/prazos';

const DIA_MS = 86_400_000;
const BRASILIA_MS = -3 * 60 * 60 * 1000; // sem horário de verão desde 2019

/** Hoje em Brasília, como `yyyy-mm-dd`. */
export function hojeBrasil(agora = new Date()): string {
  return paraISO(new Date(agora.getTime() + BRASILIA_MS));
}

/**
 * Dia útil do escritório: não é fim de semana nem feriado (nacional ou da
 * firma). Diferente de `ehDiaUtil` do DJEN, o recesso forense conta — o
 * escritório trabalha nele, só os prazos processuais ficam suspensos.
 */
function ehDiaDeExpediente(d: Date, feriados: Feriado[]): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const iso = paraISO(d);
  if (feriadosNacionais(d.getUTCFullYear()).has(iso)) return false;
  return !feriados.some((f) => f.data === iso || (f.data.length === 5 && iso.endsWith(`-${f.data}`)));
}

/**
 * Prazo de uma tarefa criada por fluxo: `dias` depois de hoje (hoje não
 * conta), vencendo às 23:59 de Brasília. Zero dias = hoje.
 */
export function calcularDataLimite(
  dias: number,
  uteis: boolean,
  feriados: Feriado[] = [],
  agora = new Date(),
): Date {
  let atual = paraData(hojeBrasil(agora));
  let restantes = dias;
  while (restantes > 0) {
    atual = new Date(atual.getTime() + DIA_MS);
    if (!uteis || ehDiaDeExpediente(atual, feriados)) restantes--;
  }
  return fimDoDiaBrasil(paraISO(atual));
}
