import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparCache } from './cache';
import { GeminiError } from './gemini';
import { narrar, type OpcoesNarrar } from './narrar';

const resposta = (resumo: string) => JSON.stringify({ resumo, pontos: [{ titulo: 'Tema', detalhe: 'Frase.' }] });

/** Gemini falso: devolve as respostas na ordem e registra o uso de cada chamada. */
function falso(...respostas: (string | Error)[]) {
  return vi.fn(async (_prompt: string, o: { aoMedirUso?: (u: { tokensEntrada: number; tokensSaida: number; custoUsd: number }) => void }) => {
    o.aoMedirUso?.({ tokensEntrada: 1000, tokensSaida: 200, custoUsd: 0.0008 });
    const r = respostas.shift();
    if (r instanceof Error) throw r;
    return r ?? '';
  });
}

const opcoes = (gerar: OpcoesNarrar['gerar'], extra: Partial<OpcoesNarrar> = {}): OpcoesNarrar => ({
  firmId: 'firma-a',
  tarefa: 'teste',
  instrucao: 'instrução',
  pergunta: 'Como foi?',
  payload: { intimacoes: '37', variacao: '+12,5%' },
  reserva: { resumo: 'Texto calculado.', pontos: [] },
  apiKey: 'chave-de-teste',
  modelo: 'gemini-3.5-flash-lite',
  gerar,
  ...extra,
});

beforeEach(() => limparCache());

describe('narrar', () => {
  it('usa o texto da IA quando os números conferem, e soma o custo', async () => {
    const r = await narrar(opcoes(falso(resposta('Chegaram 37 intimações, alta de 12,5%.'))));
    expect(r.origem).toBe('ia');
    expect(r.custoUsd).toBeCloseTo(0.0008);
    expect(r.cache).toBe(false);
  });

  it('tenta de novo com o motivo e aceita a correção', async () => {
    const gerar = falso(resposta('Chegaram 40 intimações.'), resposta('Chegaram 37 intimações.'));
    const r = await narrar(opcoes(gerar));
    expect(r.origem).toBe('ia');
    expect(gerar).toHaveBeenCalledTimes(2);
    expect(gerar.mock.calls[1][0]).toContain('números que não estão nos dados: 40');
    expect(r.custoUsd).toBeCloseTo(0.0016);
  });

  it('volta ao texto calculado depois de duas respostas com número inventado', async () => {
    const r = await narrar(opcoes(falso(resposta('Chegaram 40.'), resposta('Chegaram cerca de 12%.'))));
    expect(r.origem).toBe('calculado');
    expect(r.narracao.resumo).toBe('Texto calculado.');
    expect(r.recusados).toEqual(['12']);
  });

  it('guarda em cache por firma e payload', async () => {
    const gerar = falso(resposta('Chegaram 37.'), resposta('Chegaram 37.'));
    await narrar(opcoes(gerar));
    expect((await narrar(opcoes(gerar))).cache).toBe(true);
    expect(gerar).toHaveBeenCalledTimes(1);
    // Outra firma com o mesmo payload não lê o cache da primeira.
    expect((await narrar(opcoes(gerar, { firmId: 'firma-b' }))).cache).toBe(false);
  });

  it('não guarda falha do provedor no cache', async () => {
    const gerar = falso(new GeminiError('quota', 429), resposta('Chegaram 37.'));
    const r1 = await narrar(opcoes(gerar));
    expect(r1.origem).toBe('calculado');
    expect(r1.motivo).toBe('serviço de IA indisponível');
    const r2 = await narrar(opcoes(gerar));
    expect(r2.origem).toBe('ia');
  });

  it('sem chave não chama o provedor e mostra o texto calculado', async () => {
    const gerar = falso(resposta('x'));
    const r = await narrar(opcoes(gerar, { apiKey: null }));
    expect(gerar).not.toHaveBeenCalled();
    expect(r.origem).toBe('calculado');
    expect(r.motivo).toBe('IA não configurada no servidor');
    expect(r.enviado).toEqual({ intimacoes: '37', variacao: '+12,5%' });
  });
});
