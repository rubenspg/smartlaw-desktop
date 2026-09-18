import { describe, it, expect } from 'vitest';
import {
  aliasDatajud,
  calcularDigitosCnj,
  decomporNumeroCnj,
  formatarNumeroCnj,
  NumeroCnjInvalidoError,
  somenteDigitos,
  validarNumeroCnj,
} from './cnj';

// Números reais (públicos) usados nas verificações de 2026-09-18.
const TRF4_G1_G2 = '50192100820214047100';
const TRF4_2011 = '5000648-85.2011.4.04.7104';

describe('formatação', () => {
  it('aplica a máscara CNJ em 20 dígitos', () => {
    expect(formatarNumeroCnj(TRF4_G1_G2)).toBe('5019210-08.2021.4.04.7100');
  });

  it('devolve a entrada intacta quando não tem 20 dígitos', () => {
    expect(formatarNumeroCnj('2005.71.04.008352-6')).toBe('2005.71.04.008352-6');
  });

  it('somenteDigitos remove a máscara', () => {
    expect(somenteDigitos(TRF4_2011)).toBe('50006488520114047104');
  });
});

describe('dígitos verificadores (módulo 97)', () => {
  it('aceita números reais do TRF4', () => {
    expect(validarNumeroCnj(TRF4_G1_G2)).toBe(true);
    expect(validarNumeroCnj(TRF4_2011)).toBe(true);
  });

  it('rejeita um dígito trocado', () => {
    expect(validarNumeroCnj('50192100820214047101')).toBe(false);
    expect(validarNumeroCnj('50192100920214047100')).toBe(false);
  });

  it('rejeita tamanho errado', () => {
    expect(validarNumeroCnj('123')).toBe(false);
    expect(validarNumeroCnj('')).toBe(false);
  });

  // Conversão do formato antigo do TRF4 (AAAA.71.OO.NNNNNN-D), verificada no
  // Datajud: 2006.71.13.001100-4 existe como 0001100-32.2006.4.04.7113.
  it('recalcula os dígitos do formato antigo do TRF4', () => {
    const dd = calcularDigitosCnj({ sequencial: '0001100', ano: '2006', justica: '4', tribunal: '04', origem: '7113' });
    expect(dd).toBe('32');
    expect(validarNumeroCnj('00011003220064047113')).toBe(true);
  });

  it('decompõe as partes', () => {
    expect(decomporNumeroCnj(TRF4_G1_G2)).toEqual({
      sequencial: '5019210', digitos: '08', ano: '2021', justica: '4', tribunal: '04', origem: '7100',
    });
  });
});

describe('alias do Datajud', () => {
  const casos: Array<[string, string]> = [
    ['0000000-00.2020.3.00.0000', 'api_publica_stj'],
    ['0000000-00.2020.4.04.7100', 'api_publica_trf4'],
    ['0000000-00.2020.4.06.0000', 'api_publica_trf6'],
    ['0000000-00.2020.5.00.0000', 'api_publica_tst'],
    ['0000000-00.2020.5.04.0000', 'api_publica_trt4'],
    ['0000000-00.2020.5.24.0000', 'api_publica_trt24'],
    ['0000000-00.2020.6.00.0000', 'api_publica_tse'],
    ['0000000-00.2020.6.21.0000', 'api_publica_tre-rs'],
    ['0000000-00.2020.6.07.0000', 'api_publica_tre-df'],
    ['0000000-00.2020.7.00.0000', 'api_publica_stm'],
    ['0000000-00.2020.8.21.0053', 'api_publica_tjrs'],
    ['0000000-00.2020.8.26.0100', 'api_publica_tjsp'],
    ['0000000-00.2020.8.07.0001', 'api_publica_tjdft'],
    ['0000000-00.2020.9.21.0001', 'api_publica_tjmrs'],
    ['0000000-00.2020.9.13.0001', 'api_publica_tjmmg'],
    ['0000000-00.2020.9.26.0001', 'api_publica_tjmsp'],
  ];

  it.each(casos)('%s → %s', (numero, alias) => {
    expect(aliasDatajud(numero)).toBe(alias);
  });

  // Verificado: api_publica_stf e api_publica_cnj respondem 404.
  it('lança para STF e CNJ, que não têm índice público', () => {
    expect(() => aliasDatajud('0000000-00.2020.1.00.0000')).toThrow(NumeroCnjInvalidoError);
    expect(() => aliasDatajud('0000000-00.2020.2.00.0000')).toThrow(NumeroCnjInvalidoError);
  });

  it('lança em vez de assumir um tribunal padrão', () => {
    expect(() => aliasDatajud('0000000-00.2020.4.07.0000')).toThrow(/TRF 07/);
    expect(() => aliasDatajud('0000000-00.2020.8.99.0000')).toThrow(/99/);
    expect(() => aliasDatajud('0000000-00.2020.9.26.0001')).not.toThrow();
    expect(() => aliasDatajud('0000000-00.2020.9.01.0001')).toThrow(/Militar/);
    expect(() => aliasDatajud('123')).toThrow(/20 dígitos/);
  });
});
