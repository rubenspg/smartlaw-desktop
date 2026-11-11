import { describe, expect, it } from 'vitest';
import { numerosNaoSuportados, textoDaNarracao } from '../ia/narracao';
import { avisosDoDia, destaquesDia, diaUtilAnterior, inicioDoDiaUtc, payloadDia, reservaDia, type DiaDados } from './dia';

const dia = (over: Partial<DiaDados> = {}): DiaDados => ({
  hoje: '2026-11-10',
  desde: '2026-11-09',
  tarefas: {
    atrasadas: 2,
    hoje: 1,
    proximosDias: 4,
    semPrazo: 3,
    prioridadeAlta: 1,
    maiorAtrasoDias: 12,
    porCategoria: [
      { nome: 'PRAZO', total: 2 },
      { nome: 'AUDIENCIA', total: 1 },
    ],
  },
  intimacoes: {
    naoLidas: 5,
    novas: 3,
    porTipo: [{ nome: 'Intimação', total: 3 }],
    prazosProximos: 2,
    proximoPrazo: '2026-11-12',
    ultimaRodada: 'SUCESSO',
  },
  andamentos: { tribunal: 1590, processos: 37 },
  triagem: 1,
  ...over,
});

const vazio = dia({
  tarefas: { atrasadas: 0, hoje: 0, proximosDias: 0, semPrazo: 0, prioridadeAlta: 0, maiorAtrasoDias: null, porCategoria: [] },
  intimacoes: null,
  andamentos: { tribunal: 0, processos: 0 },
  triagem: 0,
});

describe('janela de novidades', () => {
  it('é o dia útil anterior: na segunda, a sexta', () => {
    expect(diaUtilAnterior('2026-11-10')).toBe('2026-11-09'); // terça → segunda
    expect(diaUtilAnterior('2026-11-09')).toBe('2026-11-06'); // segunda → sexta
    expect(diaUtilAnterior('2026-11-08')).toBe('2026-11-06'); // domingo → sexta
  });

  it('o dia começa à meia-noite de Brasília', () => {
    expect(inicioDoDiaUtc('2026-11-10').toISOString()).toBe('2026-11-10T03:00:00.000Z');
  });
});

describe('payload do modelo', () => {
  it('leva só agregados: nada de título, nome ou número de processo', () => {
    const texto = JSON.stringify(payloadDia(dia()));
    expect(texto).not.toMatch(/titulo|cliente|numeroProcesso|\d{7}-\d{2}\.\d{4}/i);
    expect(texto).toContain('"atrasadas":"2"');
    expect(texto).toContain('1.590');
  });

  it('omite intimações quando a firma não usa o DJEN', () => {
    expect(payloadDia(vazio)).not.toHaveProperty('intimacoesDoEscritorio');
  });

  it('o horizonte de 7 dias e as datas não são recusados pela conferência', () => {
    const texto = 'Você tem 2 tarefas atrasadas, a mais antiga há 12 dias, e 4 nos próximos 7 dias. O próximo prazo vence em 12/11.';
    expect(numerosNaoSuportados(texto, payloadDia(dia()))).toEqual([]);
    expect(numerosNaoSuportados('Você tem 9 tarefas atrasadas.', payloadDia(dia()))).toEqual(['9']);
  });
});

describe('texto calculado', () => {
  it('passa na própria conferência de números', () => {
    for (const d of [dia(), vazio, dia({ intimacoes: { ...dia().intimacoes!, ultimaRodada: 'GEOBLOQUEADO' } })]) {
      expect(numerosNaoSuportados(textoDaNarracao(reservaDia(d)), payloadDia(d))).toEqual([]);
    }
  });

  it('diz que o dia está em ordem quando não há pendência', () => {
    expect(reservaDia(vazio).resumo).toBe('Você não tem tarefas atrasadas nem com prazo para hoje.');
  });

  it('usa o singular', () => {
    const d = dia({ tarefas: { ...dia().tarefas, atrasadas: 1, hoje: 0 } });
    expect(reservaDia(d).resumo).toContain('Você tem 1 tarefa atrasada.');
  });
});

describe('DJEN bloqueado ou com erro', () => {
  const bloqueado = dia({ intimacoes: { ...dia().intimacoes!, novas: 0, porTipo: [], ultimaRodada: 'GEOBLOQUEADO' } });

  it('vira aviso, nunca "sem intimações"', () => {
    expect(avisosDoDia(bloqueado)).toHaveLength(1);
    expect(payloadDia(bloqueado).intimacoesDoEscritorio?.aviso).toMatch(/podem faltar/);
    expect(reservaDia(bloqueado).resumo).toMatch(/podem faltar intimações/);
    expect(avisosDoDia(dia({ intimacoes: { ...dia().intimacoes!, ultimaRodada: 'ERRO' } }))).toHaveLength(1);
  });

  it('rodada concluída não gera aviso', () => {
    expect(avisosDoDia(dia())).toEqual([]);
    expect(avisosDoDia(vazio)).toEqual([]);
  });
});

describe('destaques', () => {
  it('marca o que pede atenção e esconde a triagem zerada', () => {
    const d = destaquesDia(dia());
    expect(d.find((x) => x.chave === 'atrasadas')).toMatchObject({ valor: '2', tom: 'urgente' });
    expect(d.find((x) => x.chave === 'andamentos')).toMatchObject({ valor: '1.590', tom: 'neutro' });
    expect(destaquesDia(vazio).map((x) => x.chave)).toEqual(['atrasadas', 'hoje', 'proximos', 'andamentos']);
  });
});
