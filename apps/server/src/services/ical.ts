/**
 * Renderizador iCalendar (RFC 5545) para a agenda.
 *
 * Escrito à mão de propósito: o formato é texto simples e precisamos de umas
 * poucas propriedades. As três partes que realmente importam e que quase toda
 * implementação caseira erra são o escape de texto, a dobra de linha em 75
 * octetos e um UID estável — sem ele, cada atualização do feed cria eventos
 * duplicados em vez de atualizar os existentes.
 */

export interface AgendaEvent {
  id: number;
  titulo: string;
  descricao: string | null;
  dataLimite: Date;
  prioridade: string | null;
  status: string | null;
  clienteNome?: string | null;
}

/** Duração padrão de um compromisso sem hora final definida. */
const EVENT_MINUTES = 60;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Formata como UTC básico: 20260915T143000Z */
function toIcsUtc(d: Date): string {
  return (
    String(d.getUTCFullYear()) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Escapa valores de texto conforme a RFC 5545 §3.3.11. A ordem importa: a
 * barra invertida precisa ser escapada antes dos demais caracteres, senão
 * escapamos as barras que acabamos de inserir.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Dobra linhas em 75 octetos (RFC 5545 §3.1). O limite é em bytes, não em
 * caracteres — "prazo de petição" tem acentos de 2 bytes em UTF-8, então
 * contar caracteres estouraria o limite e alguns clientes truncam a linha.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Nunca cortar no meio de um caractere multibyte: recua até o início dele.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74; // linhas continuadas começam com um espaço
  }

  return parts.join('\r\n ');
}

function prop(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

function eventStatus(status: string | null): string {
  switch (status) {
    case 'CONCLUIDA':
      return 'COMPLETED';
    case 'CANCELADA':
      return 'CANCELLED';
    default:
      return 'CONFIRMED';
  }
}

/** ALTA→1 (mais urgente), MEDIA→5, BAIXA→9, conforme a escala da RFC. */
function eventPriority(prioridade: string | null): string {
  switch (prioridade) {
    case 'ALTA':
      return '1';
    case 'BAIXA':
      return '9';
    default:
      return '5';
  }
}

function buildDescription(e: AgendaEvent): string {
  const linhas: string[] = [];
  if (e.descricao) linhas.push(e.descricao);
  if (e.clienteNome) linhas.push(`Cliente: ${e.clienteNome}`);
  if (e.prioridade) linhas.push(`Prioridade: ${e.prioridade}`);
  if (e.status) linhas.push(`Status: ${e.status}`);
  return linhas.join('\n');
}

export interface CalendarOptions {
  /** Nome exibido pelo cliente de calendário. */
  nome: string;
  /** Domínio usado no UID, para que os ids sejam globalmente únicos. */
  uidDomain?: string;
}

export function renderCalendar(eventos: AgendaEvent[], options: CalendarOptions): string {
  const { nome, uidDomain = 'smartlaw.local' } = options;
  const agora = toIcsUtc(new Date());

  const linhas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SmartLaw//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    prop('X-WR-CALNAME', escapeText(nome)),
    prop('X-WR-TIMEZONE', 'America/Sao_Paulo'),
    // Dica de atualização. A Apple respeita; o Google usa o ritmo dele.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const e of eventos) {
    const inicio = e.dataLimite;
    const fim = new Date(inicio.getTime() + EVENT_MINUTES * 60 * 1000);
    const descricao = buildDescription(e);

    linhas.push('BEGIN:VEVENT');
    // UID estável por tarefa: reeditar a tarefa atualiza o evento existente.
    linhas.push(prop('UID', `tarefa-${e.id}@${uidDomain}`));
    linhas.push(prop('DTSTAMP', agora));
    linhas.push(prop('DTSTART', toIcsUtc(inicio)));
    linhas.push(prop('DTEND', toIcsUtc(fim)));
    linhas.push(prop('SUMMARY', escapeText(e.titulo)));
    if (descricao) linhas.push(prop('DESCRIPTION', escapeText(descricao)));
    linhas.push(prop('PRIORITY', eventPriority(e.prioridade)));
    linhas.push(prop('STATUS', eventStatus(e.status)));
    linhas.push('END:VEVENT');
  }

  linhas.push('END:VCALENDAR');

  // RFC 5545 exige CRLF, e o arquivo termina com quebra de linha.
  return linhas.join('\r\n') + '\r\n';
}
