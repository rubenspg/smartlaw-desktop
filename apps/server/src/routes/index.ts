import { Hono } from 'hono';
import auth from './auth';
import clientes from './clientes';
import clientesNotas from './clientes-notas';
import lookups from './lookups';
import processosJudiciais from './processos-judiciais';
import processosAdministrativos from './processos-administrativos';
import honorarios from './honorarios';
import tarefas from './tarefas';
import dashboard from './dashboard';
import usuarios from './usuarios';
import auditLogs from './audit-logs';
import { Variables } from '../middleware/auth';

const routes = new Hono<{ Variables: Variables }>()
  .route('/auth', auth)
  .route('/clientes', clientes)
  .route('/clientes/notas', clientesNotas)
  .route('/lookups', lookups)
  .route('/processos/judiciais', processosJudiciais)
  .route('/processos/administrativos', processosAdministrativos)
  .route('/honorarios', honorarios)
  .route('/tarefas', tarefas)
  .route('/dashboard', dashboard)
  .route('/usuarios', usuarios)
  .route('/audit-logs', auditLogs);

export type AppType = typeof routes;
export default routes;
