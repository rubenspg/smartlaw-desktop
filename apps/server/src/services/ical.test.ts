import { describe, it, expect } from 'vitest';
import { renderCalendar, type AgendaEvent } from './ical';

const BASE: AgendaEvent = {
  id: 1,
  titulo: 'Audiência',
  descricao: null,
  dataLimite: new Date('2026-09-18T14:30:00.000Z'),
  prioridade: 'MEDIA',
  status: 'PENDENTE',
};

const render = (parciais: Partial<AgendaEvent>[] = [{}]) =>
  renderCalendar(
    parciais.map((p, i) => ({ ...BASE, id: i + 1, ...p })),
    { nome: 'Agenda' },
  );

/** Desfaz a dobra da RFC 5545: CRLF seguido de um espaço. */
const unfold = (ics: string) => ics.replace(/\r\n /g, '');

const propriedade = (ics: string, nome: string) =>
  unfold(ics)
    .split('\r\n')
    .filter((l) => l.startsWith(nome + ':'))
    .map((l) => l.slice(nome.length + 1));

describe('estrutura', () => {
  it('abre e fecha o VCALENDAR', () => {
    const ics = render();
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('usa CRLF, nunca LF sozinho', () => {
    const ics = render([{}, {}]);
    expect(ics.split('\n').length - 1).toBe(ics.split('\r\n').length - 1);
  });

  it('termina com quebra de linha', () => {
    expect(render().endsWith('\r\n')).toBe(true);
  });

  it('continua válido sem nenhum evento', () => {
    const ics = renderCalendar([], { nome: 'Vazia' });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('todo evento traz UID, DTSTAMP, DTSTART e SUMMARY', () => {
    const ics = render([{}, {}, {}]);
    for (const p of ['UID', 'DTSTAMP', 'DTSTART', 'SUMMARY']) {
      expect(propriedade(ics, p), p).toHaveLength(3);
    }
  });
});

describe('escape de texto (RFC 5545 §3.3.11)', () => {
  // Expectativas com String.raw de propósito: em JavaScript '\;' colapsa para
  // ';', que é exatamente o bug que gerou saída inválida — e que também
  // estragou a primeira versão deste teste.

  // O bug original: um ';' cru num valor TEXT separa parâmetros.
  it('escapa ponto e vírgula', () => {
    const ics = render([{ titulo: 'Levar procuração; e contestação' }]);
    expect(propriedade(ics, 'SUMMARY')[0]).toBe(String.raw`Levar procuração\; e contestação`);
  });

  it('escapa vírgula', () => {
    const ics = render([{ titulo: 'Silva, Souza e Lima' }]);
    expect(propriedade(ics, 'SUMMARY')[0]).toBe(String.raw`Silva\, Souza e Lima`);
  });

  it('escapa barra invertida', () => {
    const ics = render([{ titulo: String.raw`pasta\arquivo` }]);
    expect(propriedade(ics, 'SUMMARY')[0]).toBe(String.raw`pasta\\arquivo`);
  });

  it('converte quebra de linha em barra-n literal', () => {
    const ics = render([{ titulo: 'linha um\nlinha dois' }]);
    expect(propriedade(ics, 'SUMMARY')[0]).toBe(String.raw`linha um\nlinha dois`);
  });

  // A ordem importa: a barra invertida tem de ser escapada primeiro, senão
  // escapamos as barras que acabamos de inserir.
  it('escapa a barra invertida antes dos demais', () => {
    const ics = render([{ titulo: String.raw`a\;b` }]);
    expect(propriedade(ics, 'SUMMARY')[0]).toBe(String.raw`a\\\;b`);
  });

  it('não deixa delimitador sem escape em nenhum valor TEXT', () => {
    const ics = render([{ titulo: 'a;b,c', descricao: 'd;e,f' }]);
    for (const nome of ['SUMMARY', 'DESCRIPTION']) {
      for (const v of propriedade(ics, nome)) {
        // Remove os pares já escapados; se sobrar ; ou , é porque saiu cru.
        const semEscapados = v.split(String.raw`\;`).join('').split(String.raw`\,`).join('');
        expect(/[;,]/.test(semEscapados), nome + ': ' + v).toBe(false);
      }
    }
  });
});

describe('dobra de linha (§3.1)', () => {
  it('nenhuma linha passa de 75 octetos', () => {
    const ics = render([{ titulo: 'x'.repeat(400), descricao: 'y'.repeat(400) }]);
    for (const l of ics.split('\r\n')) {
      expect(Buffer.byteLength(l, 'utf8'), l.slice(0, 40)).toBeLessThanOrEqual(75);
    }
  });

  // O limite é em bytes: "petição" tem acentos de 2 bytes em UTF-8. Contar
  // caracteres estouraria o limite e partiria um caractere ao meio.
  it('conta octetos, não caracteres, e não parte caractere multibyte', () => {
    const acentuado = 'áéíóú'.repeat(40);
    const ics = render([{ titulo: acentuado }]);

    for (const l of ics.split('\r\n')) {
      expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
      // Se um caractere tivesse sido partido, a linha teria U+FFFD.
      expect(l).not.toContain('�');
    }
    // E o conteúdo sobrevive ao desdobramento.
    expect(propriedade(ics, 'SUMMARY')[0]).toBe(acentuado);
  });

  it('linhas continuadas começam com um espaço', () => {
    const ics = render([{ titulo: 'z'.repeat(300) }]);
    const linhas = ics.split('\r\n');
    const continuacoes = linhas.filter((l) => l.startsWith(' '));
    expect(continuacoes.length).toBeGreaterThan(0);
  });

  it('linha curta não é dobrada', () => {
    const ics = render([{ titulo: 'curto' }]);
    expect(ics).toContain('SUMMARY:curto\r\n');
  });
});

describe('UID', () => {
  // Sem UID estável, cada atualização do feed cria eventos duplicados no
  // calendário do usuário em vez de atualizar os existentes.
  it('deriva do id da tarefa e não muda entre renderizações', () => {
    const a = propriedade(render([{ id: 42 }]), 'UID')[0];
    const b = propriedade(render([{ id: 42, titulo: 'outro título' }]), 'UID')[0];
    expect(a).toBe(b);
    expect(a).toContain('tarefa-42@');
  });

  it('é único por tarefa', () => {
    const uids = propriedade(render([{}, {}, {}]), 'UID');
    expect(new Set(uids).size).toBe(3);
  });
});

describe('mapeamentos', () => {
  it('traduz prioridade para a escala da RFC', () => {
    expect(propriedade(render([{ prioridade: 'ALTA' }]), 'PRIORITY')[0]).toBe('1');
    expect(propriedade(render([{ prioridade: 'MEDIA' }]), 'PRIORITY')[0]).toBe('5');
    expect(propriedade(render([{ prioridade: 'BAIXA' }]), 'PRIORITY')[0]).toBe('9');
    expect(propriedade(render([{ prioridade: null }]), 'PRIORITY')[0]).toBe('5');
  });

  it('traduz status', () => {
    expect(propriedade(render([{ status: 'CONCLUIDA' }]), 'STATUS')[0]).toBe('COMPLETED');
    expect(propriedade(render([{ status: 'CANCELADA' }]), 'STATUS')[0]).toBe('CANCELLED');
    expect(propriedade(render([{ status: 'PENDENTE' }]), 'STATUS')[0]).toBe('CONFIRMED');
  });
});

describe('datas', () => {
  it('formata em UTC básico', () => {
    const ics = render([{ dataLimite: new Date('2026-09-18T14:30:00.000Z') }]);
    expect(propriedade(ics, 'DTSTART')[0]).toBe('20260918T143000Z');
  });

  it('DTEND é uma hora após DTSTART', () => {
    const ics = render([{ dataLimite: new Date('2026-09-18T14:30:00.000Z') }]);
    expect(propriedade(ics, 'DTEND')[0]).toBe('20260918T153000Z');
  });

  it('atravessa a virada do dia corretamente', () => {
    const ics = render([{ dataLimite: new Date('2026-09-18T23:30:00.000Z') }]);
    expect(propriedade(ics, 'DTEND')[0]).toBe('20260919T003000Z');
  });

  it('zero-padding em mês, dia e hora de um dígito', () => {
    const ics = render([{ dataLimite: new Date('2026-01-02T03:04:05.000Z') }]);
    expect(propriedade(ics, 'DTSTART')[0]).toBe('20260102T030405Z');
  });
});

describe('descrição', () => {
  it('omite DESCRIPTION quando não há nada a dizer', () => {
    const ics = renderCalendar(
      [{ ...BASE, descricao: null, prioridade: null, status: null }],
      { nome: 'Agenda' },
    );
    expect(propriedade(ics, 'DESCRIPTION')).toHaveLength(0);
  });

  it('inclui o cliente quando houver', () => {
    const ics = render([{ descricao: 'nota', clienteNome: 'Silva Ltda' }]);
    expect(propriedade(ics, 'DESCRIPTION')[0]).toContain('Cliente: Silva Ltda');
  });
});

describe('cabeçalho do calendário', () => {
  it('leva o nome informado, escapado', () => {
    const ics = renderCalendar([], { nome: 'Agenda de Silva, Souza' });
    expect(propriedade(ics, 'X-WR-CALNAME')[0]).toBe('Agenda de Silva\\, Souza');
  });
});
