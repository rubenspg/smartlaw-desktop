import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { insightSemanaSchema } from '@smartlaw/shared';
import { env } from '../env';
import { authMiddleware, Variables } from '../middleware/auth';
import { PERFIS_INSIGHTS, requirePerfil } from '../middleware/perfil';
import { hojeBrasil } from '../services/djen';
import { narrar } from '../services/ia/narrar';
import { carregarSemanaClientes, carregarSemanaProcessos } from '../services/insights/dados';
import {
  avisoDjen,
  destaquesClientes,
  destaquesProcessos,
  detalheClientes,
  detalheProcessos,
  INSTRUCAO_PROCESSOS,
  payloadProcessos,
  PERGUNTAS,
  reservaProcessos,
  resumoClientes,
  resumoProcessos,
  janelaSemana,
} from '../services/insights/semana';

const insights = new Hono<{ Variables: Variables }>()
  .use(authMiddleware)
  /**
   * Um card semanal. Processos têm resumo da IA (só agregados, conferido número
   * a número); clientes novos são só números calculados, sem chamada à IA.
   */
  .post('/semana', requirePerfil(...PERFIS_INSIGHTS), zValidator('json', insightSemanaSchema), async (c) => {
    const user = c.get('user');
    const { area, semanasAtras } = c.req.valid('json');
    const agora = new Date();
    const janela = janelaSemana(semanasAtras, hojeBrasil(agora));
    try {
      if (area === 'clientes') {
        const s = await carregarSemanaClientes(user.firmId, janela);
        return c.json({
          area,
          pergunta: PERGUNTAS.clientes,
          semana: janela,
          destaques: destaquesClientes(s),
          resumo: resumoClientes(s),
          detalhe: detalheClientes(s),
          avisos: [] as string[],
          ia: null,
        });
      }

      const s = await carregarSemanaProcessos(user.firmId, janela, semanasAtras === 0, agora);
      const aviso = s.intimacoes ? avisoDjen(s.intimacoes) : null;
      const ia = await narrar({
        firmId: user.firmId,
        tarefa: 'insights:processos',
        instrucao: INSTRUCAO_PROCESSOS,
        pergunta: PERGUNTAS.processos,
        payload: payloadProcessos(s),
        reserva: reservaProcessos(s),
        apiKey: env.GOOGLE_API_KEY,
        modelo: env.GOOGLE_AI_MODEL,
      });
      return c.json({
        area,
        pergunta: PERGUNTAS.processos,
        semana: janela,
        destaques: destaquesProcessos(s),
        resumo: resumoProcessos(s),
        detalhe: detalheProcessos(s),
        avisos: aviso ? [aviso] : [],
        ia,
      });
    } catch (err) {
      console.error('[insights] erro ao montar a semana:', err instanceof Error ? err.message : err);
      return c.json({ error: 'Não foi possível montar o resumo da semana.' }, 500);
    }
  });

export default insights;
