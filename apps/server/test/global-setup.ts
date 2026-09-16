import postgres from 'postgres';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..');

/**
 * Cria o banco de testes se não existir e aplica as migrations nele.
 *
 * Roda uma vez por execução da suíte. Como aplica as migrations do zero, todo
 * PR passa a provar que elas sobem numa base limpa — foi exatamente isso que
 * faltou quando a migration 0004 sumiu do repositório (#31).
 */
export async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definida para os testes de integração');

  const alvo = new URL(url);
  const nomeBanco = alvo.pathname.slice(1);

  // Conecta no banco administrativo para poder criar o de testes.
  const admin = new URL(url);
  admin.pathname = '/postgres';

  const sql = postgres(admin.toString(), { max: 1 });
  try {
    const existe = await sql`SELECT 1 FROM pg_database WHERE datname = ${nomeBanco}`;
    if (existe.length === 0) {
      // Identificador não pode ser parametrizado; o nome vem da nossa própria
      // env, não de entrada de usuário.
      await sql.unsafe(`CREATE DATABASE "${nomeBanco.replace(/"/g, '')}"`);
      console.log(`[setup] banco de testes "${nomeBanco}" criado`);
    }
  } finally {
    await sql.end();
  }

  execFileSync(
    process.execPath,
    [path.join(serverDir, 'node_modules/drizzle-kit/bin.cjs'), 'migrate'],
    { cwd: serverDir, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' },
  );
  console.log('[setup] migrations aplicadas');
}
