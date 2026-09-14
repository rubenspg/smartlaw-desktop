import { db } from './index';
import { tiposAcao, ritosProcessuais, localizacoesProcesso } from './schema';
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

type LookupTable = typeof tiposAcao | typeof ritosProcessuais | typeof localizacoesProcesso;

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
  return inseridos;
}
