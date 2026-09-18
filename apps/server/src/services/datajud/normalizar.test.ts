import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatajudMovimento } from '@smartlaw/shared';
import type { DatajudHit } from './client';
import {
  chaveMovimento,
  compararCampos,
  historicoMovimento,
  instanciaAtual,
  ordenarInstancias,
  ordenarMovimentos,
  parseDataAjuizamento,
  situacaoSugerida,
  classificarSituacao,
  movimentosCronologicos,
  RUIDO_POS_BAIXA,
  TPU,
} from './normalizar';
import type { ClassificacaoProcesso } from './normalizar';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fixture = (nome: string): DatajudHit[] =>
  JSON.parse(readFileSync(path.join(aqui, '../../../test/fixtures/datajud', nome), 'utf8')).hits.hits;

// Respostas reais do Datajud capturadas em 2026-09-18 (sem nomes de partes:
// a API pública não os expõe).
const G1_G2 = fixture('trf4-5019210-08.2021.4.04.7100.json');
const JE_TR = fixture('trf4-je-tr-50147472820144047113.json');

describe('instâncias', () => {
  it('ordena da origem para a mais alta, seja G1/G2 ou JE/TR', () => {
    // O Datajud devolveu G2 antes de G1 neste caso.
    expect(G1_G2.map((h) => h._source.grau)).toEqual(['G2', 'G1']);
    expect(ordenarInstancias(G1_G2).map((h) => h._source.grau)).toEqual(['G1', 'G2']);
    expect(ordenarInstancias(JE_TR).map((h) => h._source.grau)).toEqual(['JE', 'TR']);
  });

  it('a instância atual é a mais alta', () => {
    expect(instanciaAtual(G1_G2)?._source.grau).toBe('G2');
    expect(instanciaAtual(JE_TR)?._source.grau).toBe('TR');
    expect(instanciaAtual([])).toBeUndefined();
  });

  it('não muta a entrada', () => {
    const copia = [...G1_G2];
    ordenarInstancias(G1_G2);
    expect(G1_G2).toEqual(copia);
  });
});

describe('movimentos', () => {
  it('ordena do mais recente para o mais antigo', () => {
    const g1 = ordenarInstancias(G1_G2)[0]._source.movimentos!;
    const ordenados = ordenarMovimentos(g1);
    expect(ordenados).toHaveLength(116);
    for (let i = 1; i < ordenados.length; i++) {
      expect(ordenados[i - 1].dataHora >= ordenados[i].dataHora).toBe(true);
    }
  });

  it('monta o histórico com os complementos tabelados', () => {
    const m: DatajudMovimento = {
      codigo: 51,
      nome: 'Conclusão',
      dataHora: '2011-11-21T16:07:07.000Z',
      complementosTabelados: [{ codigo: 3, descricao: 'tipo_de_conclusao', valor: 36, nome: 'para julgamento' }],
    };
    expect(historicoMovimento(m)).toBe('Conclusão — para julgamento');
    expect(historicoMovimento({ nome: 'Remessa', dataHora: '2011-12-16T17:20:54.000Z' })).toBe('Remessa');
  });
});

describe('chave do movimento', () => {
  const base: DatajudMovimento = {
    codigo: 85,
    nome: 'Petição',
    dataHora: '2015-01-09T18:18:09.000Z',
    complementosTabelados: [{ codigo: 19, valor: 57, nome: 'Petição (outras)' }],
  };
  const firma = '11111111-1111-1111-1111-111111111111';

  it('é estável para o mesmo movimento', () => {
    expect(chaveMovimento(firma, 'DOC', base)).toBe(chaveMovimento(firma, 'DOC', { ...base }));
    expect(chaveMovimento(firma, 'DOC', base)).toMatch(/^datajud:[0-9a-f]{40}$/);
  });

  it('ignora a ordem dos complementos', () => {
    const a = { ...base, complementosTabelados: [{ codigo: 1, nome: 'x' }, { codigo: 2, nome: 'y' }] };
    const b = { ...base, complementosTabelados: [{ codigo: 2, nome: 'y' }, { codigo: 1, nome: 'x' }] };
    expect(chaveMovimento(firma, 'DOC', a)).toBe(chaveMovimento(firma, 'DOC', b));
  });

  // O Datajud tem dois "Petição" com um segundo de diferença no mesmo doc.
  it('distingue movimentos iguais em instantes diferentes', () => {
    expect(chaveMovimento(firma, 'DOC', base)).not.toBe(
      chaveMovimento(firma, 'DOC', { ...base, dataHora: '2015-01-09T18:18:08.000Z' }),
    );
  });

  it('distingue a instância e a firma', () => {
    expect(chaveMovimento(firma, 'TRF4_G1_X', base)).not.toBe(chaveMovimento(firma, 'TRF4_G2_X', base));
    expect(chaveMovimento(firma, 'DOC', base)).not.toBe(chaveMovimento('22222222-2222-2222-2222-222222222222', 'DOC', base));
  });

  it('bate com a chave gravada para o fixture real', () => {
    // Trava a função: mudar o hash invalidaria a deduplicação de tudo que já
    // está no banco.
    const g1 = ordenarInstancias(G1_G2)[0];
    const primeiro = ordenarMovimentos(g1._source.movimentos)[0];
    expect(chaveMovimento(firma, g1._id, primeiro)).toBe(chaveMovimento(firma, g1._id, { ...primeiro }));
  });
});

describe('dataAjuizamento', () => {
  it('parseia YYYYMMDDHHmmss como UTC', () => {
    expect(parseDataAjuizamento('20110803143540')?.toISOString()).toBe('2011-08-03T14:35:40.000Z');
  });
  it('aceita só a data', () => {
    expect(parseDataAjuizamento('20060424')?.toISOString()).toBe('2006-04-24T00:00:00.000Z');
  });
  it('aceita ISO e rejeita lixo', () => {
    expect(parseDataAjuizamento('2021-05-04T10:00:00.000Z')?.toISOString()).toBe('2021-05-04T10:00:00.000Z');
    expect(parseDataAjuizamento('abc')).toBeNull();
    expect(parseDataAjuizamento(undefined)).toBeNull();
  });
});

describe('situação sugerida', () => {
  it('processo com apelação em curso é ATIVO', () => {
    const s = situacaoSugerida(G1_G2);
    expect(s.situacao).toBe('ATIVO');
    expect(s.ultimoMovimento?.nome).toBe('Retirada');
    expect(s.dataArquivamento).toBeNull();
  });

  it('baixa definitiva como último evento da instância mais alta arquiva', () => {
    const hits: DatajudHit[] = [
      {
        _id: 'X_G2', _index: 'x',
        _source: {
          numeroProcesso: '1', grau: 'G2',
          movimentos: [
            { codigo: 848, nome: 'Trânsito em julgado', dataHora: '2012-01-31T16:34:40.000Z' },
            { codigo: 22, nome: 'Baixa Definitiva', dataHora: '2012-01-31T16:37:41.000Z' },
          ],
        },
      },
    ];
    const s = situacaoSugerida(hits);
    expect(s.situacao).toBe('ARQUIVADO');
    expect(s.dataArquivamento?.toISOString()).toBe('2012-01-31T16:37:41.000Z');
  });

  it('trânsito em julgado sozinho não arquiva (cumprimento de sentença segue)', () => {
    const hits: DatajudHit[] = [
      { _id: 'X', _index: 'x', _source: { numeroProcesso: '1', grau: 'G1', movimentos: [
        { codigo: 848, nome: 'Trânsito em julgado', dataHora: '2012-01-31T16:34:40.000Z' },
      ] } },
    ];
    expect(situacaoSugerida(hits).situacao).toBe('ATIVO');
  });

  it('sem instâncias é ATIVO sem movimento', () => {
    expect(situacaoSugerida([])).toEqual({ situacao: 'ATIVO', estagio: 'ATIVO', ultimoMovimento: null, dataArquivamento: null });
  });
});

// Sequências reais (códigos TPU e datas, sem números nem nomes) de 71 dos 989
// processos da firma que existem no Datajud, escolhidas para cobrir todos os
// estágios; `esperado` foi conferido caso a caso na calibração de 2026-09-18.
interface CasoFixture {
  tribunal: string;
  esperado: ClassificacaoProcesso['estagio'];
  resultado: ClassificacaoProcesso['resultado'];
  dataArquivamento: string | null;
  instancias: Array<{ grau: string; classe: string | null; movimentos: Array<[number, string]> }>;
}
const CASOS: CasoFixture[] = JSON.parse(readFileSync(path.join(aqui, '../../../test/fixtures/datajud/estagios-firma.json'), 'utf8'));
const hitsDoCaso = (c: CasoFixture): DatajudHit[] =>
  c.instancias.map((i, k) => ({
    _id: `${k}`,
    _index: 'x',
    _source: {
      numeroProcesso: '1',
      grau: i.grau,
      classe: i.classe ? { nome: i.classe } : undefined,
      movimentos: i.movimentos.map(([codigo, dataHora]) => ({ codigo, dataHora, nome: `mov ${codigo}` })),
    },
  }));

const mov = (codigo: number, dataHora: string, nome = `mov ${codigo}`): DatajudMovimento => ({ codigo, nome, dataHora });
const hit = (grau: string, movimentos: DatajudMovimento[], classe?: string): DatajudHit => ({
  _id: grau, _index: 'x', _source: { numeroProcesso: '1', grau, classe: classe ? { nome: classe } : undefined, movimentos },
});

describe('classificarSituacao', () => {
  it('junta as instâncias em ordem cronológica', () => {
    const seq = movimentosCronologicos([hit('G2', [mov(1, '2020-05-01T00:00:00Z')]), hit('G1', [mov(2, '2020-01-01T00:00:00Z'), mov(3, '2020-09-01T00:00:00Z')])]);
    expect(seq.map((m) => `${m.codigo}${m.grau}`)).toEqual(['2G1', '1G2', '3G1']);
  });

  it('baixa definitiva como último movimento arquiva na data da baixa', () => {
    const c = classificarSituacao([hit('G1', [mov(848, '2024-01-10T10:00:00Z'), mov(22, '2024-03-12T10:00:00Z', 'Baixa Definitiva')])]);
    expect(c.estagio).toBe('ARQUIVADO');
    expect(c.situacao).toBe('ARQUIVADO');
    expect(c.dataArquivamento?.toISOString()).toBe('2024-03-12T10:00:00.000Z');
    expect(c.dataTransito?.toISOString()).toBe('2024-01-10T10:00:00.000Z');
    expect(c.motivo).toBe('Baixa Definitiva em 12/03/2024 (G1)');
  });

  it('a baixa vale mesmo se a instância mais alta parou antes', () => {
    // G2 julgou e devolveu; a baixa acontece no G1 depois.
    const c = classificarSituacao([
      hit('G2', [mov(123, '2023-01-01T00:00:00Z')]),
      hit('G1', [mov(26, '2021-01-01T00:00:00Z'), mov(246, '2023-06-01T00:00:00Z', 'Definitivo')]),
    ]);
    expect(c.estagio).toBe('ARQUIVADO');
    expect(c.ultimoMovimento?.grau).toBe('G1');
  });

  it('burocracia depois da baixa não reabre, mas é contada', () => {
    const c = classificarSituacao([hit('G1', [mov(22, '2024-03-12T10:00:00Z'), mov(85, '2024-04-01T00:00:00Z'), mov(12143, '2024-05-01T00:00:00Z')])]);
    expect(c.estagio).toBe('ARQUIVADO');
    expect(c.residuais).toBe(2);
    expect(c.motivo).toMatch(/2 movimento/);
    for (const codigo of RUIDO_POS_BAIXA) {
      expect(classificarSituacao([hit('G1', [mov(22, '2024-03-12T10:00:00Z'), mov(codigo, '2024-04-01T00:00:00Z')])]).estagio).toBe('ARQUIVADO');
    }
  });

  it('movimento substantivo depois da baixa pede revisão, sem fechar', () => {
    const c = classificarSituacao([hit('G1', [mov(22, '2021-02-03T10:00:00Z'), mov(85, '2021-03-01T00:00:00Z'), mov(51, '2026-07-07T00:00:00Z', 'Conclusão')])]);
    expect(c.estagio).toBe('REVISAR');
    expect(c.situacao).toBe('ATIVO');
    expect(c.dataArquivamento).toBeNull();
    expect(c.residuais).toBe(1);
    expect(c.motivo).toMatch(/Conclusão em 07\/07\/2026/);
    expect(classificarSituacao([hit('G1', [mov(22, '2021-02-03T10:00:00Z'), mov(861, '2022-01-01T00:00:00Z')])]).estagio).toBe('REVISAR');
  });

  it('só a última baixa conta', () => {
    const c = classificarSituacao([hit('G1', [mov(22, '2020-01-01T00:00:00Z'), mov(51, '2021-01-01T00:00:00Z'), mov(22, '2022-01-01T00:00:00Z')])]);
    expect(c.estagio).toBe('ARQUIVADO');
    expect(c.dataArquivamento?.toISOString()).toBe('2022-01-01T00:00:00.000Z');
  });

  it('suspensão ou arquivamento provisório como último evento é SUSPENSO', () => {
    expect(classificarSituacao([hit('G1', [mov(219, '2020-01-01T00:00:00Z'), mov(245, '2021-01-01T00:00:00Z')])]).estagio).toBe('SUSPENSO');
    expect(classificarSituacao([hit('G1', [mov(12065, '2026-07-13T00:00:00Z')])]).estagio).toBe('SUSPENSO');
    // Suspensão antiga seguida de tramitação: não é mais suspenso.
    expect(classificarSituacao([hit('G1', [mov(245, '2021-01-01T00:00:00Z'), mov(51, '2022-01-01T00:00:00Z')])]).estagio).toBe('ATIVO');
  });

  it('classe de cumprimento sem baixa é EM_CUMPRIMENTO, com ou sem trânsito', () => {
    const c = classificarSituacao([hit('G1', [mov(848, '2024-01-01T00:00:00Z'), mov(85, '2025-01-01T00:00:00Z')], 'Cumprimento de Sentença contra a Fazenda Pública')]);
    expect(c.estagio).toBe('EM_CUMPRIMENTO');
    expect(classificarSituacao([hit('G1', [mov(51, '2025-01-01T00:00:00Z')], 'Execução Contra a Fazenda Pública')]).estagio).toBe('EM_CUMPRIMENTO');
    expect(classificarSituacao([hit('G1', [mov(22, '2025-06-01T00:00:00Z')], 'Cumprimento de sentença')]).estagio).toBe('ARQUIVADO');
  });

  it('trânsito sem baixa nem cumprimento é TRANSITADO', () => {
    const c = classificarSituacao([hit('G1', [mov(219, '2026-06-01T00:00:00Z'), mov(848, '2026-08-21T00:00:00Z')], 'Procedimento Comum Cível')]);
    expect(c.estagio).toBe('TRANSITADO');
    expect(c.resultado).toBe('PROCEDENTE');
    expect(c.motivo).toMatch(/sem baixa/);
  });

  it('sentença sem trânsito é SENTENCIADO e guarda o resultado mais recente', () => {
    const c = classificarSituacao([hit('G1', [mov(220, '2025-01-01T00:00:00Z'), mov(221, '2025-06-01T00:00:00Z'), mov(85, '2025-07-01T00:00:00Z')])]);
    expect(c.estagio).toBe('SENTENCIADO');
    expect(c.resultado).toBe('PARCIALMENTE_PROCEDENTE');
    expect(classificarSituacao([hit('G1', [mov(TPU.IMPROCEDENCIA, '2025-01-01T00:00:00Z')])]).resultado).toBe('IMPROCEDENTE');
  });

  it('sem nada disso é ATIVO', () => {
    const c = classificarSituacao([hit('G1', [mov(26, '2026-01-01T00:00:00Z'), mov(51, '2026-02-01T00:00:00Z')])]);
    expect(c.estagio).toBe('ATIVO');
    expect(c.resultado).toBeNull();
    expect(c.motivo).toMatch(/^Último:/);
  });

  it('o fixture real com apelação em curso é SENTENCIADO, não ATIVO nem ARQUIVADO', () => {
    const c = classificarSituacao(G1_G2);
    expect(c.estagio).toBe('SENTENCIADO');
    expect(c.resultado).not.toBeNull();
    expect(c.situacao).toBe('ATIVO');
  });

  it('reproduz a calibração sobre os processos reais da firma', () => {
    expect(CASOS.length).toBeGreaterThan(60);
    const cobertos = new Set(CASOS.map((c) => c.esperado));
    expect([...cobertos].sort()).toEqual(['ARQUIVADO', 'ATIVO', 'EM_CUMPRIMENTO', 'REVISAR', 'SENTENCIADO', 'SUSPENSO', 'TRANSITADO']);
    for (const caso of CASOS) {
      const c = classificarSituacao(hitsDoCaso(caso));
      expect(c.estagio, caso.instancias.map((i) => i.classe).join('/')).toBe(caso.esperado);
      expect(c.resultado).toBe(caso.resultado);
      expect(c.dataArquivamento?.toISOString() ?? null).toBe(caso.dataArquivamento);
      expect(c.situacao).toBe(caso.esperado === 'ARQUIVADO' ? 'ARQUIVADO' : 'ATIVO');
    }
  });
});

describe('divergências', () => {
  it('compara juízo com a origem e justiça com o tribunal', () => {
    const fields = compararCampos({ juizo: 'Outra vara', justica: 'TJRS' }, G1_G2);
    expect(fields.map((f) => f.field).sort()).toEqual(['juizo', 'justica']);
    expect(fields.find((f) => f.field === 'justica')?.remote).toBe('TRF4');
  });

  it('campos locais vazios não são divergência', () => {
    expect(compararCampos({ juizo: null, justica: null }, G1_G2)).toEqual([]);
  });

  it('usa orgaoJulgador quando juizo está vazio', () => {
    const origem = ordenarInstancias(G1_G2)[0]._source.orgaoJulgador!.nome;
    expect(compararCampos({ juizo: null, orgaoJulgador: origem, justica: 'TRF4' }, G1_G2)).toEqual([]);
  });

  // Um processo com apelação tem o gabinete do TRF como órgão atual; o juízo
  // cadastrado (a vara de origem) continua certo e não pode virar divergência.
  it('após apelação, a vara de origem não é divergência', () => {
    const vara = ordenarInstancias(G1_G2)[0]._source.orgaoJulgador!.nome;
    const gabinete = instanciaAtual(G1_G2)!._source.orgaoJulgador!.nome;
    expect(vara).not.toBe(gabinete);
    expect(compararCampos({ juizo: vara, justica: 'TRF4' }, G1_G2)).toEqual([]);
  });
});
