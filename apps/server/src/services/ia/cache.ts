import { createHash } from 'node:crypto';

/**
 * Cache em memória das respostas do modelo.
 *
 * A chave é o hash do payload exato (mais firma, modelo e instrução), então
 * qualquer número novo gera outra chave e nada fica velho: semanas passadas
 * não mudam e voltar nelas não custa outra chamada. O TTL e o teto só limitam
 * a memória. Por processo de propósito: a API é um único processo no LXC 103.
 */

interface Entrada<T> {
  valor: T;
  expiraEm: number;
}

const TTL_PADRAO_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRADAS = 300;

const store = new Map<string, Entrada<unknown>>();

export function chaveCache(...partes: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(partes)).digest('hex');
}

export function lerCache<T>(chave: string): T | undefined {
  const hit = store.get(chave);
  if (!hit) return undefined;
  if (hit.expiraEm < Date.now()) {
    store.delete(chave);
    return undefined;
  }
  // Reinsere para a entrada mais usada sobreviver à remoção da mais antiga.
  store.delete(chave);
  store.set(chave, hit);
  return hit.valor as T;
}

export function gravarCache<T>(chave: string, valor: T, ttlMs = TTL_PADRAO_MS): void {
  if (store.size >= MAX_ENTRADAS) {
    const maisAntiga = store.keys().next();
    if (!maisAntiga.done) store.delete(maisAntiga.value);
  }
  store.set(chave, { valor, expiraEm: Date.now() + ttlMs });
}

/** Para os testes. */
export function limparCache(): void {
  store.clear();
}
