import { describe, expect, it } from 'vitest';
import { ehSomenteData, formatarData, formatarHora } from './datas';

describe('formatarData', () => {
  it('não desloca para o dia anterior uma data gravada como meia-noite UTC', () => {
    // Era exibido "13/02/2088 19:00" num Mac em Nova York e "13/02 21:00" no Brasil.
    expect(formatarData('2088-02-14T00:00:00.000Z')).toBe('14/02/2088');
    expect(formatarData('2088-02-14T00:00:00+00:00')).toBe('14/02/2088');
  });

  it('aceita a data pura do Postgres (coluna date)', () => {
    expect(formatarData('1971-05-03')).toBe('03/05/1971');
  });

  it('mostra horários reais no fuso do escritório', () => {
    // 02:30 UTC = 23:30 do dia anterior em São Paulo.
    expect(formatarData('2026-03-27T02:30:00Z')).toBe('26/03/2026');
    expect(formatarHora('2026-03-27T02:30:00Z')).toBe('23:30');
  });

  it('respeita as opções de formato', () => {
    expect(formatarData('2026-11-01', { month: 'short', year: '2-digit' })).toMatch(/nov/);
  });

  it('devolve o texto de vazio para nulos e o valor cru para lixo', () => {
    expect(formatarData(null)).toBe('-');
    expect(formatarData(undefined, undefined, '')).toBe('');
    expect(formatarData('não é data')).toBe('não é data');
  });
});

describe('formatarHora', () => {
  it('fica vazio quando o valor não tem hora', () => {
    expect(formatarHora('2026-03-26T00:00:00Z')).toBe('');
    expect(ehSomenteData('2026-03-26T00:00:00Z')).toBe(true);
    expect(ehSomenteData('2026-03-26T00:00:01Z')).toBe(false);
  });
});
