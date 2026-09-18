import { describe, it, expect } from 'vitest';
import {
  calcularPrazo,
  ehDiaUtil,
  emRecesso,
  feriadosNacionais,
  fimDoDiaBrasil,
  motivoNaoUtil,
  paraData,
  pascoa,
  proximoDiaUtil,
  somarDiasUteis,
  paraISO,
} from './prazos';

describe('calendário', () => {
  it('calcula a Páscoa', () => {
    expect(paraISO(pascoa(2024))).toBe('2024-03-31');
    expect(paraISO(pascoa(2025))).toBe('2025-04-20');
    expect(paraISO(pascoa(2026))).toBe('2026-04-05');
  });

  it('deriva os feriados móveis da Páscoa', () => {
    const f = feriadosNacionais(2026);
    expect(f.get('2026-02-16')).toMatch(/Carnaval/);
    expect(f.get('2026-02-17')).toMatch(/Carnaval/);
    expect(f.get('2026-04-03')).toBe('Sexta-feira Santa');
    expect(f.get('2026-06-04')).toBe('Corpus Christi');
    expect(f.get('2026-09-07')).toMatch(/Independência/);
  });

  it('Consciência Negra só é nacional desde 2024', () => {
    expect(feriadosNacionais(2023).has('2023-11-20')).toBe(false);
    expect(feriadosNacionais(2024).has('2024-11-20')).toBe(true);
  });

  it('recesso forense vai de 20/12 a 20/01', () => {
    expect(emRecesso(paraData('2026-12-19'))).toBe(false);
    expect(emRecesso(paraData('2026-12-20'))).toBe(true);
    expect(emRecesso(paraData('2027-01-20'))).toBe(true);
    expect(emRecesso(paraData('2027-01-21'))).toBe(false);
  });

  it('explica por que um dia não conta', () => {
    expect(motivoNaoUtil(paraData('2026-09-19'))).toBe('fim de semana');
    expect(motivoNaoUtil(paraData('2026-09-07'))).toMatch(/Independência/);
    expect(motivoNaoUtil(paraData('2026-12-24'))).toMatch(/recesso/);
    expect(motivoNaoUtil(paraData('2026-09-18'))).toBeNull();
  });

  it('feriados da firma: todo ano (MM-DD) ou só num ano (YYYY-MM-DD)', () => {
    const feriados = [
      { data: '09-22', nome: 'Local anual' },
      { data: '2026-09-23', nome: 'Ponto facultativo de 2026' },
    ];
    expect(ehDiaUtil(paraData('2026-09-22'), { feriados })).toBe(false);
    expect(ehDiaUtil(paraData('2027-09-22'), { feriados })).toBe(false);
    expect(ehDiaUtil(paraData('2026-09-23'), { feriados })).toBe(false);
    expect(ehDiaUtil(paraData('2027-09-23'), { feriados })).toBe(true);
  });

  it('proximoDiaUtil pula fim de semana e feriado', () => {
    // Sexta 04/09/2026 → sábado, domingo, feriado (segunda 07/09) → terça 08/09.
    expect(paraISO(proximoDiaUtil(paraData('2026-09-04')))).toBe('2026-09-08');
  });

  it('somarDiasUteis conta o início como dia 1', () => {
    expect(paraISO(somarDiasUteis(paraData('2026-09-21'), 1))).toBe('2026-09-21');
    expect(paraISO(somarDiasUteis(paraData('2026-09-21'), 5))).toBe('2026-09-25');
    // Início em dia não útil: o dia 1 é o próximo útil.
    expect(paraISO(somarDiasUteis(paraData('2026-09-19'), 1))).toBe('2026-09-21');
    expect(() => somarDiasUteis(paraData('2026-09-21'), 0)).toThrow();
  });
});

describe('calcularPrazo (Lei 11.419 art. 4º; CPC arts. 219, 220, 224)', () => {
  it('publicação no dia útil seguinte, contagem a partir do próximo', () => {
    // Quinta 17/09: publicação sexta 18/09, dia 1 segunda 21/09, dia 5 sexta 25/09.
    expect(calcularPrazo('2026-09-17', 5)).toEqual({
      publicacao: '2026-09-18',
      inicio: '2026-09-21',
      fim: '2026-09-25',
      dias: 5,
    });
  });

  it('disponibilização em feriado empurra a publicação', () => {
    const p = calcularPrazo('2026-09-07', 15);
    expect(p.publicacao).toBe('2026-09-08');
    expect(p.inicio).toBe('2026-09-09');
    expect(p.fim).toBe('2026-09-29');
  });

  it('feriado local da firma adia o termo final', () => {
    const p = calcularPrazo('2026-09-07', 15, { feriados: [{ data: '09-22', nome: 'Local' }] });
    expect(p.fim).toBe('2026-09-30');
  });

  it('recesso suspende a contagem', () => {
    // Sexta 18/12/2026: 21/12 já é recesso → publicação quinta 21/01/2027, dia 1 sexta 22/01.
    const p = calcularPrazo('2026-12-18', 5);
    expect(p.publicacao).toBe('2027-01-21');
    expect(p.inicio).toBe('2027-01-22');
    expect(p.fim).toBe('2027-01-28');
  });

  it('fimDoDiaBrasil é 23:59:59 em -03:00', () => {
    expect(fimDoDiaBrasil('2026-09-25').toISOString()).toBe('2026-09-26T02:59:59.000Z');
  });
});
