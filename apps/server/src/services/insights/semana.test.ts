import { describe, expect, it } from 'vitest';
import type { DatajudMovimento } from '@smartlaw/shared';
import { numerosNaoSuportados } from '../ia/narracao';
import {
  avisoDjen,
  diasSemConsulta,
  janelaBase,
  janelaSemana,
  limitesUtc,
  mudancasDeEstagio,
  payloadProcessos,
  reservaProcessos,
  resumoProcessos,
  type SemanaProcessos,
} from './semana';

describe('janela da semana', () => {
  it('são os 7 dias até hoje, recuando de 7 em 7', () => {
    expect(janelaSemana(0, '2026-10-20')).toEqual({ inicio: '2026-10-14', fim: '2026-10-20', rotulo: '14/10 a 20/10' });
    expect(janelaSemana(1, '2026-10-20')).toMatchObject({ inicio: '2026-10-07', fim: '2026-10-13' });
    expect(janelaBase(janelaSemana(0, '2026-10-20'))).toEqual({ inicio: '2026-09-16', fim: '2026-10-13' });
  });

  it('converte as datas de Brasília em instantes UTC, fim exclusivo', () => {
    const { de, ate } = limitesUtc('2026-10-14', '2026-10-20');
    expect(de.toISOString()).toBe('2026-10-14T03:00:00.000Z');
    expect(ate.toISOString()).toBe('2026-10-21T03:00:00.000Z');
  });
});

describe('cobertura do DJEN', () => {
  const j = janelaSemana(0, '2026-10-20'); // qua 14 a ter 20: 5 dias úteis

  it('conta dias úteis que nenhuma rodada concluída cobriu', () => {
    expect(diasSemConsulta(j, [{ janelaInicio: '2026-10-11', janelaFim: '2026-10-16' }])).toEqual({ uteis: 5, faltando: 2 });
    expect(diasSemConsulta(j, [])).toEqual({ uteis: 5, faltando: 5 });
  });

  const intimacoes = (diasSemConsulta: number, geobloqueios = 0) => ({
    total: 0, mediaAnterior: 6, porTipo: [], diasUteis: 5, diasSemConsulta, geobloqueios, erros: 0,
  });

  // Semana geobloqueada não pode virar "nenhuma intimação".
  it('semana sem consulta concluída leva aviso ao payload, ao resumo e ao texto calculado', () => {
    const s = semana({ intimacoes: intimacoes(5, 3) });
    const aviso = avisoDjen(s.intimacoes!);
    expect(aviso).toBe('O DJEN não foi consultado com sucesso nesta semana, com 3 bloqueios geográficos: o número de intimações está incompleto.');
    expect(payloadProcessos(s).intimacoes?.aviso).toBe(aviso);
    expect(resumoProcessos(s)[0]).toContain('consulta incompleta');
    expect(reservaProcessos(s).resumo).toContain(aviso!);
  });

  it('semana toda consultada não tem aviso', () => {
    expect(avisoDjen(intimacoes(0))).toBeNull();
    expect(payloadProcessos(semana({ intimacoes: intimacoes(0) })).intimacoes).not.toHaveProperty('aviso');
  });

  it('firma que nunca usou o DJEN não fala de intimações', () => {
    const s = semana({ intimacoes: null });
    expect(payloadProcessos(s)).not.toHaveProperty('intimacoes');
    expect(resumoProcessos(s)[0]).toMatch(/^[\d.]+ andamentos/);
  });
});

const mov = (codigo: number, dataHora: string): DatajudMovimento => ({ codigo, nome: `mov ${codigo}`, dataHora });
const instancia = (grau: string, movimentos: DatajudMovimento[]) => ({
  _source: { numeroProcesso: '1', tribunal: 'TJSP', grau, movimentos } as never,
});

describe('mudancasDeEstagio', () => {
  const { de, ate } = limitesUtc('2026-10-14', '2026-10-20');

  it('compara o estágio antes e depois da semana e agrupa por transição', () => {
    const processos = [
      // Baixa definitiva (22) na semana: Ativo → Arquivado.
      [instancia('G1', [mov(26, '2026-01-10T10:00:00Z'), mov(22, '2026-10-15T10:00:00Z')])],
      [instancia('G1', [mov(26, '2026-02-10T10:00:00Z'), mov(22, '2026-10-16T10:00:00Z')])],
      // Trânsito (848) na semana: Ativo → Transitado, sem fechar.
      [instancia('G1', [mov(26, '2026-03-10T10:00:00Z'), mov(848, '2026-10-17T10:00:00Z')])],
      // Movimento depois da semana não conta.
      [instancia('G1', [mov(26, '2026-03-10T10:00:00Z'), mov(22, '2026-10-22T10:00:00Z')])],
    ];
    expect(mudancasDeEstagio(processos, de, ate)).toEqual([
      { de: 'ATIVO', para: 'ARQUIVADO', total: 2 },
      { de: 'ATIVO', para: 'TRANSITADO', total: 1 },
    ]);
  });

  it('movimento relevante depois da baixa, em outra instância, vira Revisar', () => {
    const processos = [
      [
        instancia('G1', [mov(26, '2025-01-10T10:00:00Z'), mov(22, '2025-06-10T10:00:00Z')]),
        instancia('G2', [mov(26, '2026-10-15T10:00:00Z')]),
      ],
    ];
    expect(mudancasDeEstagio(processos, de, ate)).toEqual([{ de: 'ARQUIVADO', para: 'REVISAR', total: 1 }]);
  });
});

function semana(extra: Partial<SemanaProcessos> = {}): SemanaProcessos {
  return {
    janela: janelaSemana(0, '2026-10-20'),
    intimacoes: {
      total: 12, mediaAnterior: 8.5, porTipo: [{ nome: 'Intimação', total: 10 }, { nome: 'Citação', total: 2 }],
      diasUteis: 5, diasSemConsulta: 0, geobloqueios: 0, erros: 0,
    },
    andamentos: { tribunal: 1240, manuais: 15, mediaAnterior: 980.25, processos: 87 },
    novos: { judiciais: 3, administrativos: 1, emTriagem: 2 },
    mudancasEstagio: [{ de: 'SENTENCIADO', para: 'TRANSITADO', total: 2 }],
    hoje: {
      triagem: 5, revisar: 7, parados: 31,
      paradosPorComarca: [{ nome: 'Curitiba', total: 12 }, { nome: 'Londrina', total: 4 }],
      paradosPorTipoAcao: [{ nome: 'Aposentadoria por idade', total: 9 }],
    },
    ...extra,
  };
}

describe('payload dos processos', () => {
  it('leva strings pt-BR e só números que o texto calculado também usa', () => {
    const s = semana();
    const p = payloadProcessos(s);
    expect(p.andamentos.total).toBe('1.255');
    expect(p.andamentos.mediaSemanal).toBe('980,3');
    expect(p.intimacoes?.variacao).toBe('+41,2%');
    // Nada do que o código escreve fica de fora da conferência.
    expect(numerosNaoSuportados(reservaProcessos(s).resumo, p)).toEqual([]);
    expect(numerosNaoSuportados(resumoProcessos(s).join('\n'), p)).toEqual([]);
  });

  it('a posição de hoje só entra na semana atual', () => {
    expect(payloadProcessos(semana({ hoje: null }))).not.toHaveProperty('posicaoDeHoje');
  });

  // LGPD: só agregados. A prova contra dados reais do banco está em insights.itest.ts.
  it('não tem campo de identificação de pessoa ou processo', () => {
    const chaves = JSON.stringify(payloadProcessos(semana())).match(/"(\w+)":/g)!.map((k) => k.slice(1, -2));
    const proibidas = /nome|cpf|cnpj|numero|cnj|parte|texto|historico|oab|advogad|email|telefone|celular|endereco|cliente|usuario/i;
    expect(chaves.filter((k) => proibidas.test(k))).toEqual([]);
  });
});
