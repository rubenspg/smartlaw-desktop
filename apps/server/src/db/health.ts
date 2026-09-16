import { sql } from 'drizzle-orm';
import { db } from './index';

/**
 * Confere se o banco responde.
 *
 * Existe separado da rota para poder ser testado dos dois lados: o caminho
 * feliz por teste de integração, e a falha com o módulo do banco mockado.
 */
export async function verificarBanco(timeoutMs = 2000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, rejeitar) => {
        timer = setTimeout(() => rejeitar(new Error('timeout')), timeoutMs);
      }),
    ]);
    return true;
  } catch (err) {
    // Um /health que mente é pior que um /health que falha: o deploy conclui
    // "API saudável" e o escritório é quem descobre que não está.
    console.error('[Health] banco inacessível:', err instanceof Error ? err.message : err);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
