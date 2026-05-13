import { db } from '../apps/server/src/db';
import { profiles } from '../apps/server/src/db/schema';

async function run() {
  try {
    const users = await db.select().from(profiles);
    console.log('--- USUARIOS NO BANCO LOCAL ---');
    users.forEach(u => {
      console.log(`- ${u.email} (${u.nome}) [Ativo: ${u.ativo}]`);
    });
  } catch (err) {
    console.error('Erro ao acessar o banco:', err.message);
  }
  process.exit(0);
}
run();
