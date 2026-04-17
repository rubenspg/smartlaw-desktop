import { Hono } from 'hono';
import { db } from '../db';
import { municipios, especiesProcesso, tiposAcao, ritosProcessuais, localizacoesProcesso, posicoesParte } from '../db/schema';
import { asc, ilike } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';

const lookupsRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/municipios', async (c) => {
    const { q } = c.req.query();
    const query = db.select().from(municipios);
    
    if (q) {
      query.where(ilike(municipios.nome, `%${q}%`));
    }

    const data = await query.limit(50).orderBy(asc(municipios.nome));
    return c.json(data);
  })

  .get('/especies-processo', async (c) => {
    const data = await db.select().from(especiesProcesso).orderBy(asc(especiesProcesso.descricao));
    return c.json(data);
  })

  .get('/tipos-acao', async (c) => {
    const data = await db.select().from(tiposAcao).orderBy(asc(tiposAcao.descricao));
    return c.json(data);
  })

  .get('/ritos-processuais', async (c) => {
    const data = await db.select().from(ritosProcessuais).orderBy(asc(ritosProcessuais.descricao));
    return c.json(data);
  })

  .get('/localizacoes-processo', async (c) => {
    const data = await db.select().from(localizacoesProcesso).orderBy(asc(localizacoesProcesso.descricao));
    return c.json(data);
  })

  .get('/posicoes-parte', async (c) => {
    const data = await db.select().from(posicoesParte).orderBy(asc(posicoesParte.descricao));
    return c.json(data);
  });

export default lookupsRoutes;
