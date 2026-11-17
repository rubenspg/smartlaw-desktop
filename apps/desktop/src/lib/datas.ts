/**
 * Formatação de datas do app.
 *
 * Datas sem hora (andamento digitado no formulário, distribuição, cadastro,
 * tudo o que veio da migração do sistema antigo) são gravadas como meia-noite
 * UTC. Formatadas no fuso local, caíam no dia anterior: "14/02" virava
 * "13/02 21:00" no Brasil. Aqui elas são lidas em UTC; horários reais são
 * mostrados no fuso do escritório, que é onde os prazos valem.
 */

const LOCALE = 'pt-BR';
export const FUSO_ESCRITORIO = 'America/Sao_Paulo';
const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

type Entrada = Date | string | number | null | undefined;

function paraDate(valor: Entrada): Date | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const d =
    typeof valor === 'string' && SO_DATA.test(valor) ? new Date(`${valor}T00:00:00Z`) : new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}

/** Valor sem hora: "AAAA-MM-DD" ou instante exatamente à meia-noite UTC. */
export function ehSomenteData(valor: Entrada): boolean {
  if (typeof valor === 'string' && SO_DATA.test(valor)) return true;
  const d = paraDate(valor);
  return (
    !!d &&
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

/** "14/02/2026" (ou o formato pedido em `options`), sem deslocar o dia. */
export function formatarData(valor: Entrada, options?: Intl.DateTimeFormatOptions, vazio = '-'): string {
  const d = paraDate(valor);
  if (!d) return valor ? String(valor) : vazio;
  const timeZone = ehSomenteData(valor) ? 'UTC' : FUSO_ESCRITORIO;
  return new Intl.DateTimeFormat(LOCALE, { ...(options ?? {}), timeZone }).format(d);
}

/** "14:30" no fuso do escritório; vazio quando o valor não tem hora. */
export function formatarHora(valor: Entrada): string {
  if (ehSomenteData(valor)) return '';
  const d = paraDate(valor);
  if (!d) return '';
  return new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO_ESCRITORIO,
  }).format(d);
}
