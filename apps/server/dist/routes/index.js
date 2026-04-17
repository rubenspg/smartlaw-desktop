import { Hono } from 'hono';
import auth from './auth';
import clientes from './clientes';
const routes = new Hono()
    .route('/auth', auth)
    .route('/clientes', clientes);
export default routes;
