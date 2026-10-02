import { and, asc, eq, inArray } from 'drizzle-orm';
import type { WorkflowAcao, WorkflowGatilho } from '@smartlaw/shared';
import { db } from '../../db';
import { clientes, firms, profiles, tarefas, workflowExecucoes, workflows } from '../../db/schema';
import { calcularDataLimite } from './prazo';
import { listarSituacoes } from './situacoes';
import { condicoesAtendidas, preencher } from './regras';

/**
 * Motor dos fluxos de trabalho. As rotas chamam `dispararEvento` depois de
 * gravar (cliente criado, situação alterada); ele roda os fluxos ativos da
 * firma para aquele gatilho, cada um na sua transação, e registra o resultado
 * em `workflow_execucoes`.
 *
 * Nunca lança: um fluxo mal configurado não pode impedir o cadastro que o
 * disparou. A falha fica no histórico (status ERRO) para o admin ver.
 */

export interface EventoCliente {
  gatilho: WorkflowGatilho;
  firmId: string;
  clienteId: number;
  /** Quem fez a ação que disparou o evento. */
  usuarioId: string | null;
  situacaoAnterior?: string | null;
  situacaoNova?: string | null;
}

/**
 * Uma ação de fluxo pode disparar outro fluxo (mudar a situação dispara
 * CLIENTE_SITUACAO_ALTERADA). Dois freios contra laço: cada fluxo roda no
 * máximo uma vez por cadeia, e a cadeia tem profundidade limitada.
 */
export const MAX_ENCADEAMENTO = 3;

interface Cadeia {
  profundidade: number;
  executados: Set<number>;
}

/** Erro de configuração, com mensagem que pode ir para o histórico. */
export class ErroFluxo extends Error {}

type Fluxo = typeof workflows.$inferSelect;
type Cliente = typeof clientes.$inferSelect;

export async function dispararEvento(
  evento: EventoCliente,
  cadeia: Cadeia = { profundidade: 0, executados: new Set() },
): Promise<void> {
  try {
    await processar(evento, cadeia);
  } catch (err) {
    console.error(`[Fluxos] Falha ao processar ${evento.gatilho} do cliente ${evento.clienteId}:`, err);
  }
}

async function processar(evento: EventoCliente, cadeia: Cadeia) {
  const fluxos = await db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.firmId, evento.firmId),
        eq(workflows.gatilho, evento.gatilho),
        eq(workflows.ativo, true),
      ),
    )
    .orderBy(asc(workflows.id));
  if (fluxos.length === 0) return;

  const contexto = await carregarContexto(evento);
  const seguintes: EventoCliente[] = [];
  const executados = new Set(cadeia.executados);

  for (const fluxo of fluxos) {
    const cliente = await buscarCliente(evento);
    if (!cliente) return; // excluído no meio do caminho
    if (!condicoesAtendidas(fluxo.condicoes, cliente, evento)) continue;

    if (executados.has(fluxo.id) || cadeia.profundidade >= MAX_ENCADEAMENTO) {
      await registrar(evento, fluxo, 'IGNORADO', [], 'Encadeamento interrompido: o fluxo já rodou nesta sequência ou o limite de fluxos em cadeia foi atingido.');
      continue;
    }
    executados.add(fluxo.id);

    try {
      seguintes.push(...(await executar(fluxo, cliente, evento, contexto)));
    } catch (err) {
      const msg = err instanceof ErroFluxo ? err.message : 'Erro interno ao executar o fluxo.';
      if (!(err instanceof ErroFluxo)) {
        console.error(`[Fluxos] Erro no fluxo ${fluxo.id}:`, err);
      }
      await registrar(evento, fluxo, 'ERRO', [], msg);
    }
  }

  for (const proximo of seguintes) {
    await processar(proximo, { profundidade: cadeia.profundidade + 1, executados });
  }
}

interface Contexto {
  feriados: NonNullable<typeof firms.$inferSelect.feriados>;
  nomeSituacao: Map<string, string>;
  autor: string;
}

async function carregarContexto(evento: EventoCliente): Promise<Contexto> {
  const [firma] = await db
    .select({ feriados: firms.feriados })
    .from(firms)
    .where(eq(firms.id, evento.firmId));
  const situacoes = await listarSituacoes(evento.firmId);
  let autor = '';
  if (evento.usuarioId) {
    const [u] = await db
      .select({ nome: profiles.nome })
      .from(profiles)
      .where(and(eq(profiles.id, evento.usuarioId), eq(profiles.firmId, evento.firmId)));
    autor = u?.nome ?? '';
  }
  return {
    feriados: firma?.feriados ?? [],
    nomeSituacao: new Map(situacoes.map((s) => [s.codigo, s.nome])),
    autor,
  };
}

async function buscarCliente(evento: EventoCliente): Promise<Cliente | undefined> {
  const [cliente] = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.id, evento.clienteId), eq(clientes.firmId, evento.firmId)));
  return cliente;
}

async function executar(
  fluxo: Fluxo,
  cliente: Cliente,
  evento: EventoCliente,
  ctx: Contexto,
): Promise<EventoCliente[]> {
  const valores = { 'cliente.nome': cliente.nome, 'usuario.nome': ctx.autor };
  const nome = (codigo: string | null) => (codigo ? (ctx.nomeSituacao.get(codigo) ?? codigo) : '—');

  // Responsáveis de todas as ações de tarefa, validados de uma vez. Quem saiu
  // da firma ou foi desativado é trocado pelo admin mais antigo — a mesma regra
  // das tarefas do DJEN.
  const pedidos = fluxo.acoes.flatMap((a) => (a.tipo === 'CRIAR_TAREFA' ? [a.usuarioId] : []));
  const ativos = pedidos.length
    ? await db
        .select({ id: profiles.id, nome: profiles.nome })
        .from(profiles)
        .where(
          and(
            eq(profiles.firmId, evento.firmId),
            eq(profiles.ativo, true),
            inArray(profiles.id, pedidos),
          ),
        )
    : [];
  const responsavel = new Map(ativos.map((p) => [p.id, p]));
  const [adminPadrao] = pedidos.some((id) => !responsavel.has(id))
    ? await db
        .select({ id: profiles.id, nome: profiles.nome })
        .from(profiles)
        .where(
          and(eq(profiles.firmId, evento.firmId), eq(profiles.ativo, true), eq(profiles.perfil, 'admin')),
        )
        .orderBy(asc(profiles.createdAt))
        .limit(1)
    : [];

  return db.transaction(async (tx) => {
    const [execucao] = await tx
      .insert(workflowExecucoes)
      .values({
        firmId: evento.firmId,
        workflowId: fluxo.id,
        workflowNome: fluxo.nome,
        gatilho: evento.gatilho,
        clienteId: cliente.id,
        disparadoPor: evento.usuarioId,
        status: 'SUCESSO',
      })
      .returning({ id: workflowExecucoes.id });

    const resultado: string[] = [];
    const seguintes: EventoCliente[] = [];
    let situacaoAtual = cliente.situacao;

    for (const acao of fluxo.acoes as WorkflowAcao[]) {
      if (acao.tipo === 'ALTERAR_SITUACAO_CLIENTE') {
        if (!ctx.nomeSituacao.has(acao.situacao)) {
          throw new ErroFluxo(`A situação "${acao.situacao}" não existe mais. Edite o fluxo.`);
        }
        if (situacaoAtual === acao.situacao) {
          resultado.push(`Situação já era ${nome(acao.situacao)}`);
          continue;
        }
        await tx
          .update(clientes)
          .set({ situacao: acao.situacao, updatedAt: new Date() })
          .where(and(eq(clientes.id, cliente.id), eq(clientes.firmId, evento.firmId)));
        resultado.push(`Situação: ${nome(situacaoAtual)} → ${nome(acao.situacao)}`);
        seguintes.push({
          gatilho: 'CLIENTE_SITUACAO_ALTERADA',
          firmId: evento.firmId,
          clienteId: cliente.id,
          usuarioId: evento.usuarioId,
          situacaoAnterior: situacaoAtual,
          situacaoNova: acao.situacao,
        });
        situacaoAtual = acao.situacao;
      } else if (acao.tipo === 'CRIAR_TAREFA') {
        const pessoa = responsavel.get(acao.usuarioId) ?? adminPadrao;
        if (!pessoa) {
          throw new ErroFluxo('O responsável da tarefa está inativo e a firma não tem administrador ativo.');
        }
        const titulo = preencher(acao.titulo, valores);
        await tx.insert(tarefas).values({
          firmId: evento.firmId,
          usuarioId: pessoa.id,
          clienteId: cliente.id,
          titulo,
          descricao: acao.descricao ? preencher(acao.descricao, valores) : null,
          dataLimite:
            acao.prazoDias == null
              ? null
              : calcularDataLimite(acao.prazoDias, acao.prazoUteis ?? true, ctx.feriados),
          prioridade: acao.prioridade ?? 'MEDIA',
          categoria: acao.categoria ?? 'GERAL',
          status: 'PENDENTE',
          workflowExecucaoId: execucao.id,
        });
        const substituto = pessoa.id !== acao.usuarioId ? ' (responsável original inativo)' : '';
        resultado.push(`Tarefa "${titulo}" para ${pessoa.nome}${substituto}`);
      }
    }

    await tx
      .update(workflowExecucoes)
      .set({ resultado })
      .where(eq(workflowExecucoes.id, execucao.id));
    return seguintes;
  });
}

async function registrar(
  evento: EventoCliente,
  fluxo: Fluxo,
  status: 'ERRO' | 'IGNORADO',
  resultado: string[],
  erro: string,
) {
  await db.insert(workflowExecucoes).values({
    firmId: evento.firmId,
    workflowId: fluxo.id,
    workflowNome: fluxo.nome,
    gatilho: evento.gatilho,
    clienteId: evento.clienteId,
    disparadoPor: evento.usuarioId,
    status,
    resultado,
    erro,
  });
}
