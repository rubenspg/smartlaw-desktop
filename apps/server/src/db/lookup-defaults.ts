import { db } from './index';
import { tiposAcao, ritosProcessuais, localizacoesProcesso, especiesProcesso, posicoesParte } from './schema';
import { sql } from 'drizzle-orm';

/**
 * Valores padrão para as tabelas de lookup de processos judiciais.
 *
 * O seed original depende de CSVs legados em `CSV_DATA_DIR`, um caminho fora do
 * repositório. Quando esses arquivos não existem, as tabelas ficam vazias e os
 * campos "Tipo de Ação", "Rito" e "Localização Atual" abrem sem nenhuma opção.
 * Estes defaults garantem uma base utilizável em qualquer instalação.
 */

export const TIPOS_ACAO_PADRAO = [
  { codigo: 'CIVEL', descricao: 'Cível' },
  { codigo: 'TRABALHISTA', descricao: 'Trabalhista' },
  { codigo: 'PREVIDENCIARIO', descricao: 'Previdenciário' },
  { codigo: 'FAMILIA', descricao: 'Família e Sucessões' },
  { codigo: 'CONSUMIDOR', descricao: 'Consumidor' },
  { codigo: 'TRIBUTARIO', descricao: 'Tributário' },
  { codigo: 'CRIMINAL', descricao: 'Criminal' },
  { codigo: 'ADMINISTRATIVO', descricao: 'Administrativo' },
  { codigo: 'EMPRESARIAL', descricao: 'Empresarial' },
  { codigo: 'COBRANCA', descricao: 'Cobrança' },
  { codigo: 'EXECUCAO', descricao: 'Execução' },
  { codigo: 'EXECUCAO_FISCAL', descricao: 'Execução Fiscal' },
  { codigo: 'MONITORIA', descricao: 'Monitória' },
  { codigo: 'INDENIZATORIA', descricao: 'Indenizatória' },
  { codigo: 'CONSIGNACAO_PAGAMENTO', descricao: 'Consignação em Pagamento' },
  { codigo: 'BUSCA_APREENSAO', descricao: 'Busca e Apreensão' },
  { codigo: 'DESPEJO', descricao: 'Despejo' },
  { codigo: 'INVENTARIO', descricao: 'Inventário' },
  { codigo: 'USUCAPIAO', descricao: 'Usucapião' },
  { codigo: 'MANDADO_SEGURANCA', descricao: 'Mandado de Segurança' },
  { codigo: 'EMBARGOS', descricao: 'Embargos' },
  { codigo: 'OUTROS', descricao: 'Outros' },
];

export const RITOS_PADRAO = [
  { codigo: 'COMUM', descricao: 'Procedimento Comum' },
  { codigo: 'ORDINARIO', descricao: 'Ordinário' },
  { codigo: 'SUMARIO', descricao: 'Sumário' },
  { codigo: 'SUMARISSIMO', descricao: 'Sumaríssimo' },
  { codigo: 'ESPECIAL', descricao: 'Procedimento Especial' },
  { codigo: 'JUIZADO_ESPECIAL', descricao: 'Juizado Especial' },
  { codigo: 'EXECUCAO', descricao: 'Execução' },
  { codigo: 'CAUTELAR', descricao: 'Cautelar' },
  { codigo: 'MONITORIO', descricao: 'Monitório' },
  { codigo: 'RECURSAL', descricao: 'Recursal' },
];

export const LOCALIZACOES_PADRAO = [
  { codigo: 'DISTRIBUICAO', descricao: 'Distribuição' },
  { codigo: 'CARTORIO', descricao: 'Cartório' },
  { codigo: 'SECRETARIA', descricao: 'Secretaria' },
  { codigo: 'GABINETE', descricao: 'Gabinete' },
  { codigo: 'CONCLUSO_DESPACHO', descricao: 'Concluso para Despacho' },
  { codigo: 'CONCLUSO_DECISAO', descricao: 'Concluso para Decisão' },
  { codigo: 'CONCLUSO_SENTENCA', descricao: 'Concluso para Sentença' },
  { codigo: 'CONTADORIA', descricao: 'Contadoria' },
  { codigo: 'MINISTERIO_PUBLICO', descricao: 'Ministério Público' },
  { codigo: 'PERITO', descricao: 'Com o Perito' },
  { codigo: 'VISTA_PARTES', descricao: 'Vista às Partes' },
  { codigo: 'AGUARDANDO_AUDIENCIA', descricao: 'Aguardando Audiência' },
  { codigo: 'AGUARDANDO_PERICIA', descricao: 'Aguardando Perícia' },
  { codigo: 'TRIBUNAL', descricao: 'No Tribunal (Recurso)' },
  { codigo: 'SUSPENSO', descricao: 'Suspenso' },
  { codigo: 'ARQUIVO_PROVISORIO', descricao: 'Arquivo Provisório' },
  { codigo: 'ARQUIVO', descricao: 'Arquivo' },
  { codigo: 'BAIXADO', descricao: 'Baixado' },
];

/**
 * Espécies de processo administrativo. O escritório é de previdenciário, então
 * a tabela legada é essencialmente a lista de benefícios do INSS pelo código B.
 */
export const ESPECIES_PADRAO = [
  { codigo: 'B21', descricao: 'B 21 PENSÃO POR MORTE' },
  { codigo: 'B25', descricao: 'B 25 AUXÍLIO RECLUSÃO' },
  { codigo: 'B31', descricao: 'B 31 AUXÍLIO-DOENÇA' },
  { codigo: 'B32', descricao: 'B 32 APOSENTADORIA POR INVALIDEZ' },
  { codigo: 'B41', descricao: 'B 41 APOSENTADORIA POR IDADE' },
  { codigo: 'B42', descricao: 'B 42 APOSENTADORIA POR TEMPO DE CONTRIBUIÇÃO' },
  { codigo: 'B46', descricao: 'B 46 APOSENTADORIA ESPECIAL' },
  { codigo: 'B57', descricao: 'B 57 APOSENTADORIA PARA PROFESSOR' },
  { codigo: 'B80', descricao: 'B 80 SALÁRIO MATERNIDADE' },
  { codigo: 'B87', descricao: 'B 87 AMPARO SOCIAL À PESSOA COM DEFICIÊNCIA' },
  { codigo: 'B88', descricao: 'B 88 AMPARO SOCIAL AO IDOSO' },
  { codigo: 'B91', descricao: 'B 91 AUXÍLIO-DOENÇA ACIDENTE DE TRABALHO' },
  { codigo: 'B94', descricao: 'B 94 AUXÍLIO-ACIDENTE' },
  { codigo: 'AVERBACAO_RURAL', descricao: 'AVERBAÇÃO DE PERÍODO RURAL' },
  { codigo: 'CONTAGEM_TEMPO', descricao: 'CONTAGEM DE TEMPO E RENDA' },
  { codigo: 'REVISAO', descricao: 'REVISÃO DE BENEFÍCIO' },
  { codigo: 'OUTROS', descricao: 'OUTROS' },
];

export const POSICOES_PARTE_PADRAO = [
  { codigo: 'AUTOR', descricao: 'AUTOR' },
  { codigo: 'REU', descricao: 'RÉU' },
  { codigo: 'REQUERENTE', descricao: 'REQUERENTE' },
  { codigo: 'REQUERIDO', descricao: 'REQUERIDO' },
  { codigo: 'EXEQUENTE', descricao: 'EXEQUENTE' },
  { codigo: 'EXECUTADO', descricao: 'EXECUTADO' },
  { codigo: 'TERCEIRO', descricao: 'TERCEIRO INTERESSADO' },
];

type LookupTable =
  | typeof tiposAcao
  | typeof ritosProcessuais
  | typeof localizacoesProcesso
  | typeof especiesProcesso
  | typeof posicoesParte;

async function seedIfEmpty(
  nome: string,
  table: LookupTable,
  registros: { codigo: string; descricao: string }[],
): Promise<number> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(table);

  // Instalações que importaram os CSVs legados já têm a própria tabela de
  // domínio — não misturamos os defaults com esses códigos.
  if (total > 0) {
    console.log(`  • ${nome}: ${total} registros já existentes, defaults ignorados.`);
    return 0;
  }

  await db.insert(table).values(registros).onConflictDoNothing();
  console.log(`  ✓ ${nome}: ${registros.length} registros padrão inseridos.`);
  return registros.length;
}

export async function ensureLookupDefaults() {
  console.log('🔎 Verificando tabelas de lookup de processos...');
  let inseridos = 0;
  inseridos += await seedIfEmpty('tipos_acao', tiposAcao, TIPOS_ACAO_PADRAO);
  inseridos += await seedIfEmpty('ritos_processuais', ritosProcessuais, RITOS_PADRAO);
  inseridos += await seedIfEmpty('localizacoes_processo', localizacoesProcesso, LOCALIZACOES_PADRAO);
  inseridos += await seedIfEmpty('especies_processo', especiesProcesso, ESPECIES_PADRAO);
  inseridos += await seedIfEmpty('posicoes_parte', posicoesParte, POSICOES_PARTE_PADRAO);
  return inseridos;
}
