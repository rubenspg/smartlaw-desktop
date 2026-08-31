import { Context, Next } from 'hono';
import { Variables } from './auth';

export type Perfil = 'admin' | 'usuario' | 'administrativo' | 'secretaria';

/** Perfis autorizados a ver e lançar valores financeiros. */
export const PERFIS_FINANCEIRO: Perfil[] = ['admin', 'administrativo'];

/**
 * Restringe uma rota a uma lista explícita de perfis.
 *
 * Sempre allowlist: um perfil novo não recebe acesso por omissão.
 */
export const requirePerfil = (...allowed: Perfil[]) => {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    const user = c.get('user');
    if (!user || !allowed.includes(user.perfil as Perfil)) {
      return c.json({ error: 'Acesso negado' }, 403);
    }
    await next();
  };
};
