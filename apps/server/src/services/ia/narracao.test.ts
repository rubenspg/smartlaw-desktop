import { describe, expect, it } from 'vitest';
import { formatarNumero, formatarPct, lerNarracao, numerosNaoSuportados } from './narracao';

describe('formatadores pt-BR', () => {
  it('usa ponto de milhar e vírgula decimal', () => {
    expect(formatarNumero(1590)).toBe('1.590');
    expect(formatarNumero(8.5, 1)).toBe('8,5');
    expect(formatarPct(12.5)).toBe('+12,5%');
    expect(formatarPct(-3)).toBe('-3,0%');
    expect(formatarPct(null)).toBeNull();
  });
});

describe('numerosNaoSuportados', () => {
  const payload = { recebido: 'R$ 1.590,64', variacao: '+12,5%', intimacoes: '37', semana: '14/10 a 20/10' };

  it('aceita números pt-BR copiados do payload', () => {
    const texto = 'O escritório recebeu R$ 1.590,64 e 37 intimações; a alta foi de 12,5%.';
    expect(numerosNaoSuportados(texto, payload)).toEqual([]);
  });

  it('recusa um número arredondado', () => {
    expect(numerosNaoSuportados('Alta de 12% na semana.', payload)).toEqual(['12']);
    expect(numerosNaoSuportados('Recebeu R$ 1.590,6.', payload)).toEqual(['1590.6']);
  });

  it('recusa "R$ 12 mil"', () => {
    const p = { recebido: 'R$ 12.000,00', processos: '12' };
    expect(numerosNaoSuportados('Entraram R$ 12 mil.', p)).toEqual(['12 mil']);
  });

  it('recusa um número que o modelo calculou', () => {
    // 37 + 12,5 não está nos dados.
    expect(numerosNaoSuportados('Somados, são 49,5.', payload)).toEqual(['49.5']);
  });

  it('não conta datas como números', () => {
    expect(numerosNaoSuportados('Na semana de 14/10 a 20/10/2026, e desde 2026-10-01.', payload)).toEqual([]);
  });

  it('recusa formato en-US em vez de lê-lo como outro número', () => {
    expect(numerosNaoSuportados('Alta de 12.5%.', payload)).toEqual(['12.5']);
  });

  it('ignora algarismos colados em letras', () => {
    expect(numerosNaoSuportados('Movimentos no G1 e na 2ª vara.', payload)).toEqual([]);
  });

  it('trata CNJ e OAB como identificador inteiro, não como algarismos soltos', () => {
    const p = { ano: '2024', total: '56' };
    expect(numerosNaoSuportados('O processo 0001234-56.2024.8.26.0100 andou.', p)).toEqual(['0001234-56.2024.8.26.0100']);
    expect(numerosNaoSuportados('A OAB/SP 123.456 recebeu.', p)).toEqual(['OAB/SP 123.456']);
  });
});

describe('lerNarracao', () => {
  it('aceita resposta cercada por ``` e recusa lixo', () => {
    expect(lerNarracao('```json\n{"resumo":"Ok.","pontos":[]}\n```')).toEqual({ resumo: 'Ok.', pontos: [] });
    expect(lerNarracao('Claro! Aqui está')).toBeNull();
    expect(lerNarracao('{"pontos":[]}')).toBeNull();
  });

  it('descarta pontos mal formados e limita a 3', () => {
    const r = lerNarracao(
      JSON.stringify({ resumo: 'R', pontos: [{ titulo: 'a', detalhe: 'b' }, { titulo: 1 }, ...Array(4).fill({ titulo: 'c', detalhe: 'd' })] }),
    );
    expect(r?.pontos).toHaveLength(3);
    expect(r?.pontos[0]).toEqual({ titulo: 'a', detalhe: 'b' });
  });
});
