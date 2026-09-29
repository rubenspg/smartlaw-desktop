import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { clienteSituacoes, type SituacaoCor } from '../../db/schema';

/** As mesmas que a migration 0011 semeou nas firmas que já existiam. */
export const SITUACOES_PADRAO: {
  codigo: string;
  nome: string;
  cor: SituacaoCor;
  contaComoAtivo: boolean;
  sistema: boolean;
  ordem: number;
}[] = [
  { codigo: 'A', nome: 'Ativo', cor: 'success', contaComoAtivo: true, sistema: true, ordem: 0 },
  { codigo: 'EM_REVISAO', nome: 'Em revisão', cor: 'warning', contaComoAtivo: true, sistema: false, ordem: 10 },
  { codigo: 'I', nome: 'Inativo', cor: 'destructive', contaComoAtivo: false, sistema: true, ordem: 99 },
];

/**
 * Situações da firma, em ordem de exibição. Uma firma criada depois da 0011
 * ainda não tem nenhuma: recebe as padrão no primeiro acesso.
 */
export async function listarSituacoes(firmId: string) {
  const consultar = () =>
    db
      .select()
      .from(clienteSituacoes)
      .where(eq(clienteSituacoes.firmId, firmId))
      .orderBy(asc(clienteSituacoes.ordem), asc(clienteSituacoes.nome));

  const atuais = await consultar();
  if (atuais.length > 0) return atuais;

  await db
    .insert(clienteSituacoes)
    .values(SITUACOES_PADRAO.map((s) => ({ ...s, firmId })))
    .onConflictDoNothing();
  return consultar();
}

export async function situacaoExiste(firmId: string, codigo: string): Promise<boolean> {
  const [s] = await db
    .select({ id: clienteSituacoes.id })
    .from(clienteSituacoes)
    .where(and(eq(clienteSituacoes.firmId, firmId), eq(clienteSituacoes.codigo, codigo)))
    .limit(1);
  // A firma sem nenhuma situação cadastrada ainda aceita as padrão.
  if (s) return true;
  return (await listarSituacoes(firmId)).some((x) => x.codigo === codigo);
}
