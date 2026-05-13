import { db } from '../apps/server/src/db';
import { profiles } from '../apps/server/src/db/schema';
import { eq, like } from 'drizzle-orm';

async function check() {
  console.log('--- Buscando Usuários ---');
  const allUsers = await db.select().from(profiles);
  allUsers.forEach(u => {
    console.log(`- ID: ${u.id} | Nome: ${u.nome} | Email: ${u.email} | Perfil: ${u.perfil} | Ativo: ${u.ativo}`);
  });
  
  const mateus = allUsers.find(u => u.nome.toLowerCase().includes('mateus') || u.email.toLowerCase().includes('mateus'));
  
  if (mateus) {
    if (!mateus.ativo) {
      console.log('Ativando Mateus...');
      await db.update(profiles).set({ ativo: true }).where(eq(profiles.id, mateus.id));
      console.log('✅ Mateus ativado!');
    } else {
      console.log('Mateus já está ativo.');
    }
  } else {
    console.log('❌ Mateus não encontrado no banco.');
  }
  process.exit(0);
}

check().catch(console.error);
