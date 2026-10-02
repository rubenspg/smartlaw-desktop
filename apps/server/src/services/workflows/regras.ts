import type { WorkflowCondicoes } from '@smartlaw/shared';

// Regras puras do motor, sem banco: testáveis sem DATABASE_URL.

export function condicoesAtendidas(
  condicoes: WorkflowCondicoes,
  cliente: { tipo: string },
  evento: { situacaoAnterior?: string | null; situacaoNova?: string | null },
): boolean {
  if (condicoes.tipoCliente && cliente.tipo !== condicoes.tipoCliente) return false;
  if (condicoes.situacaoAnterior && evento.situacaoAnterior !== condicoes.situacaoAnterior) return false;
  if (condicoes.situacaoNova && evento.situacaoNova !== condicoes.situacaoNova) return false;
  return true;
}

/** Troca só os marcadores conhecidos; o resto do texto fica como está. */
export function preencher(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (marcador, chave: string) =>
    chave in valores ? valores[chave] : marcador,
  );
}

/**
 * Código gravado em `clientes.situacao` a partir do nome digitado:
 * "Aguardando documentos" → "AGUARDANDO_DOCUMENTOS".
 */
export function codigoDaSituacao(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
