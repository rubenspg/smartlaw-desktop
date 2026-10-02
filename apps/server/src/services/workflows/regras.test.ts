import { describe, it, expect } from 'vitest';
import { calcularDataLimite, hojeBrasil } from './prazo';
import { codigoDaSituacao, condicoesAtendidas, preencher } from './regras';

// Datas de referência: 29/09/2026 é terça-feira; 12/10/2026 (N. Sra. Aparecida) é segunda.
const fim = (iso: string) => new Date(`${iso}T23:59:59-03:00`).toISOString();

describe('calcularDataLimite', () => {
  it('conta dias úteis a partir de amanhã', () => {
    expect(calcularDataLimite(3, true, [], new Date('2026-09-29T15:00:00Z')).toISOString()).toBe(fim('2026-10-02'));
  });

  it('pula fim de semana e feriado nacional', () => {
    // sexta 09/10 + 1 útil: sábado, domingo e o feriado de segunda não contam
    expect(calcularDataLimite(1, true, [], new Date('2026-10-09T15:00:00Z')).toISOString()).toBe(fim('2026-10-13'));
  });

  it('dias corridos não pulam nada', () => {
    expect(calcularDataLimite(3, false, [], new Date('2026-10-09T15:00:00Z')).toISOString()).toBe(fim('2026-10-12'));
  });

  it('zero dias vence hoje', () => {
    expect(calcularDataLimite(0, true, [], new Date('2026-09-29T15:00:00Z')).toISOString()).toBe(fim('2026-09-29'));
  });

  it('respeita feriado local da firma', () => {
    const feriados = [{ data: '09-30', nome: 'Feriado municipal' }];
    expect(calcularDataLimite(1, true, feriados, new Date('2026-09-29T15:00:00Z')).toISOString()).toBe(fim('2026-10-01'));
  });

  // O recesso forense suspende prazos processuais, não o expediente do escritório.
  it('recesso forense conta como dia útil', () => {
    expect(calcularDataLimite(1, true, [], new Date('2026-12-21T15:00:00Z')).toISOString()).toBe(fim('2026-12-22'));
  });

  it('"hoje" é o dia em Brasília, não em UTC', () => {
    expect(hojeBrasil(new Date('2026-09-30T02:00:00Z'))).toBe('2026-09-29');
  });
});

describe('preencher', () => {
  it('troca os marcadores conhecidos e mantém os demais', () => {
    expect(preencher('Docs de {{cliente.nome}} ({{ usuario.nome }}) {{outro}}', {
      'cliente.nome': 'Maria',
      'usuario.nome': 'Ana',
    })).toBe('Docs de Maria (Ana) {{outro}}');
  });
});

describe('condicoesAtendidas', () => {
  const pf = { tipo: 'F' };
  it('sem condições sempre atende', () => {
    expect(condicoesAtendidas({}, pf, {})).toBe(true);
  });
  it('filtra por tipo e por transição de situação', () => {
    expect(condicoesAtendidas({ tipoCliente: 'J' }, pf, {})).toBe(false);
    const cond = { situacaoAnterior: 'EM_REVISAO', situacaoNova: 'A' };
    expect(condicoesAtendidas(cond, pf, { situacaoAnterior: 'EM_REVISAO', situacaoNova: 'A' })).toBe(true);
    expect(condicoesAtendidas(cond, pf, { situacaoAnterior: 'I', situacaoNova: 'A' })).toBe(false);
  });
});

describe('codigoDaSituacao', () => {
  it('gera código sem acento, em maiúsculas', () => {
    expect(codigoDaSituacao('Aguardando documentação')).toBe('AGUARDANDO_DOCUMENTACAO');
    expect(codigoDaSituacao('  Em revisão!  ')).toBe('EM_REVISAO');
    expect(codigoDaSituacao('!!!')).toBe('');
  });
});
