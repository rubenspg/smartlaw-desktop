import { Hono } from 'hono';
import { db } from '../db';
import { municipios, especiesProcesso, tiposAcao, ritosProcessuais, localizacoesProcesso, posicoesParte, profiles } from '../db/schema';
import { asc, ilike, eq, and, sql } from 'drizzle-orm';
import { authMiddleware, Variables } from '../middleware/auth';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const lookupCreateSchema = z.object({
  descricao: z.string().trim().min(1, 'Descrição é obrigatória').max(120),
});

type LookupTable = typeof tiposAcao | typeof ritosProcessuais | typeof localizacoesProcesso;

/** Deriva um código estável a partir da descrição: "Consignação em Pagamento" -> "CONSIGNACAO_EM_PAGAMENTO". */
function slugify(descricao: string): string {
  const base = descricao
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || 'ITEM';
}

/**
 * Cria uma entrada de lookup sob demanda, para que o advogado não fique
 * bloqueado quando a opção do escritório não existe na tabela de domínio.
 * Idempotente: uma descrição já cadastrada devolve o registro existente.
 */
async function createLookupEntry(table: LookupTable, descricao: string) {
  const existente = await db
    .select()
    .from(table)
    .where(sql`lower(${table.descricao}) = lower(${descricao})`)
    .limit(1);

  if (existente.length > 0) {
    return { registro: existente[0], criado: false };
  }

  const base = slugify(descricao);
  // Colisão de código é possível (descrições distintas podem gerar o mesmo
  // slug), então sufixamos até encontrar um livre.
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const codigo = tentativa === 0 ? base : `${base}_${tentativa + 1}`;
    const [inserido] = await db
      .insert(table)
      .values({ codigo, descricao })
      .onConflictDoNothing()
      .returning();

    if (inserido) return { registro: inserido, criado: true };
  }

  throw new Error('Não foi possível gerar um código único para este registro');
}

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
    const query = q
      ? db.select().from(municipios).where(ilike(municipios.nome, `%${q}%`))
      : db.select().from(municipios);

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
  })

  .post('/tipos-acao', zValidator('json', lookupCreateSchema), async (c) => {
    const { descricao } = c.req.valid('json');
    const { registro, criado } = await createLookupEntry(tiposAcao, descricao);
    return c.json(registro, criado ? 201 : 200);
  })

  .post('/ritos-processuais', zValidator('json', lookupCreateSchema), async (c) => {
    const { descricao } = c.req.valid('json');
    const { registro, criado } = await createLookupEntry(ritosProcessuais, descricao);
    return c.json(registro, criado ? 201 : 200);
  })

  .post('/localizacoes-processo', zValidator('json', lookupCreateSchema), async (c) => {
    const { descricao } = c.req.valid('json');
    const { registro, criado } = await createLookupEntry(localizacoesProcesso, descricao);
    return c.json(registro, criado ? 201 : 200);
  });

export default lookupsRoutes;
