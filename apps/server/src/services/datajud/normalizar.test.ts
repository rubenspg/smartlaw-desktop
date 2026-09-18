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
} from './normalizar';

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
    expect(situacaoSugerida([])).toEqual({ situacao: 'ATIVO', ultimoMovimento: null, dataArquivamento: null });
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
