import { describe, it, expect } from 'vitest';
import {
  advogadosDoItem,
  chaveOab,
  dedupePorId,
  ehInformativa,
  normalizarOab,
  numeroExibicao,
  prazoSugerido,
  resumoTexto,
  textoPlano,
  tituloTarefa,
} from './normalizar';
import type { DjenItem } from './types';

const item = (extra: Partial<DjenItem> = {}): DjenItem => ({
  id: 1,
  hash: 'h',
  data_disponibilizacao: '2026-09-18',
  siglaTribunal: 'TRF4',
  tipoComunicacao: 'Intimação',
  tipoDocumento: 'Ato ordinatório',
  numero_processo: '50192100820214047100',
  numeroprocessocommascara: '5019210-08.2021.4.04.7100',
  ...extra,
});

describe('OAB', () => {
  it('normaliza as grafias que o DJEN devolve', () => {
    expect(normalizarOab('RS062492')).toBe('62492');
    expect(normalizarOab('062492')).toBe('62492');
    expect(normalizarOab('62492')).toBe('62492');
    expect(normalizarOab(' rs 62.492 ')).toBe('62492');
    expect(normalizarOab('99221A')).toBe('99221A'); // sufixo de inscrição fica
    expect(normalizarOab('')).toBe('');
  });

  it('chaveOab junta UF e número', () => {
    expect(chaveOab('RS062492', 'rs')).toBe('RS:62492');
  });

  it('advogadosDoItem normaliza e remove repetidos', () => {
    const adv = advogadosDoItem(
      item({
        destinatarioadvogados: [
          { advogado: { nome: 'A', numero_oab: 'RS062492', uf_oab: 'RS' } },
          { advogado: { nome: 'A', numero_oab: '62492', uf_oab: 'RS' } },
          { advogado: { nome: 'B', numero_oab: '55817', uf_oab: 'rs' } },
        ],
      }),
    );
    expect(adv).toEqual([
      { nome: 'A', numero: '62492', uf: 'RS' },
      { nome: 'B', numero: '55817', uf: 'RS' },
    ]);
  });
});

describe('dedupe e tipos', () => {
  it('um item por id, mantendo o primeiro', () => {
    const r = dedupePorId([item({ id: 1, siglaTribunal: 'A' }), item({ id: 2 }), item({ id: 1, siglaTribunal: 'B' })]);
    expect(r.map((i) => i.id)).toEqual([1, 2]);
    expect(r[0].siglaTribunal).toBe('A');
  });

  it('só as três comunicações informativas não abrem prazo', () => {
    expect(ehInformativa({ tipoComunicacao: 'Lista de distribuição' })).toBe(true);
    expect(ehInformativa({ tipoComunicacao: 'Pauta de julgamento' })).toBe(true);
    expect(ehInformativa({ tipoComunicacao: 'Ata de sessão' })).toBe(true);
    expect(ehInformativa({ tipoComunicacao: 'Intimação' })).toBe(false);
    expect(ehInformativa({ tipoComunicacao: 'Edital' })).toBe(false);
  });
});

describe('prazoSugerido', () => {
  const dias = (extra: Partial<DjenItem>) => prazoSugerido(item(extra))?.dias ?? null;

  it('segue a tabela conservadora', () => {
    expect(dias({ tipoComunicacao: 'Citação', tipoDocumento: 'Ato ordinatório' })).toBe(15);
    expect(dias({ tipoDocumento: 'Sentença' })).toBe(15);
    expect(dias({ tipoDocumento: 'Acórdão' })).toBe(15);
    expect(dias({ tipoDocumento: 'Sentença', nomeClasse: 'PROCEDIMENTO DO JUIZADO ESPECIAL CÍVEL' })).toBe(10);
    expect(dias({ tipoDocumento: 'Ato ordinatório' })).toBe(5);
    expect(dias({ tipoDocumento: 'DESPACHO/DECISÃO' })).toBe(5);
    expect(dias({ tipoDocumento: 'Outros' })).toBe(15);
    expect(dias({ tipoDocumento: null })).toBe(15);
  });

  it('informativas não têm prazo', () => {
    expect(dias({ tipoComunicacao: 'Lista de distribuição', tipoDocumento: 'Outros' })).toBeNull();
    expect(dias({ tipoComunicacao: 'Ata de sessão', tipoDocumento: 'Ata de sessão de julgamento' })).toBeNull();
  });

  it('traz o fundamento', () => {
    expect(prazoSugerido(item({ tipoDocumento: 'DESPACHO/DECISÃO' }))?.motivo).toMatch(/218/);
  });
});

describe('textoPlano', () => {
  it('remove style/script/head, quebra blocos e desfaz entidades', () => {
    const html =
      '<html><head><style>.x{color:red}</style></head><body><article><header><div></div></header>' +
      '<section><b>MANDADO DE SEGURAN&Ccedil;A</b><br>N&ordm; 5003431-95.2026.4.04.7113<p>ADVOGADO(A)&nbsp;: RAFAEL (OAB RS062492)</p>' +
      '<table><tr><td>a</td><td>b</td></tr></table><script>alert(1)</script>&#237;ntegra &#x41;</section></article></body></html>';
    expect(textoPlano(html)).toBe(
      'MANDADO DE SEGURANÇA\nNº 5003431-95.2026.4.04.7113\nADVOGADO(A) : RAFAEL (OAB RS062492)\na b\níntegra A',
    );
  });

  it('é tolerante a vazio', () => {
    expect(textoPlano(null)).toBe('');
    expect(textoPlano('   ')).toBe('');
  });
});

describe('títulos', () => {
  it('numeroExibicao usa a máscara ou monta a partir dos dígitos', () => {
    expect(numeroExibicao(item())).toBe('5019210-08.2021.4.04.7100');
    expect(numeroExibicao(item({ numeroprocessocommascara: null }))).toBe('5019210-08.2021.4.04.7100');
    expect(numeroExibicao(item({ numeroprocessocommascara: null, numero_processo: '123' }))).toBe('123');
  });

  it('tituloTarefa identifica tipo e processo', () => {
    expect(tituloTarefa(item({ tipoDocumento: 'Sentença' }))).toBe('Intimação — Sentença — 5019210-08.2021.4.04.7100');
    expect(tituloTarefa(item({ tipoDocumento: null }))).toBe('Intimação — Intimação — 5019210-08.2021.4.04.7100');
  });

  it('resumoTexto compacta e trunca', () => {
    expect(resumoTexto('a\n\nb   c\nd')).toBe('a · b c · d');
    expect(resumoTexto('x'.repeat(700), 100)).toHaveLength(100);
    expect(resumoTexto('x'.repeat(700), 100).endsWith('…')).toBe(true);
  });
});
