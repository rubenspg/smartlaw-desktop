import { Hono } from 'hono';
import { db } from '../db';
import { municipios, especiesProcesso, tiposAcao, ritosProcessuais, localizacoesProcesso, posicoesParte, profiles } from '../db/schema';
import { asc, ilike, eq, and } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';

const lookupsRoutes = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  
  .get('/usuarios', async (c) => {
    const user = c.get('user');
    const data = await db
      .select({
        id: profiles.id,
        nome: profiles.nome,
        email: profiles.email,
      })
      .from(profiles)
      .where(and(eq(profiles.firmId, user.firmId), eq(profiles.ativo, true)))
      .orderBy(asc(profiles.nome));
    
    return c.json(data);
  })
  
  .get('/municipios', async (c) => {
    const { q } = c.req.query();
    const query = db.select().from(municipios);

    if (q) {
      query.where(ilike(municipios.nome, `%${q}%`));
    }

    const data = await query.limit(50).orderBy(asc(municipios.nome));
    return c.json(data);
  })

  .get('/municipios/by-ibge/:ibge', async (c) => {
    const ibge = c.req.param('ibge');
    const m = await db.query.municipios.findFirst({
      where: eq(municipios.codIbge, ibge),
    });
    if (!m) return c.json({ error: 'Município não encontrado' }, 404);
    return c.json(m);
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
