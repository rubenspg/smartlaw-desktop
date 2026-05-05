
import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('🚀 Iniciando migração manual do tipo perfil...');
  const sql = postgres(process.env.DATABASE_URL!);
  
  try {
    // Tenta adicionar o valor 'secretaria' ao ENUM perfil
    await sql`ALTER TYPE perfil ADD VALUE IF NOT EXISTS 'secretaria'`;
    console.log('✅ Valor "secretaria" adicionado com sucesso ao ENUM perfil!');
  } catch (err) {
    console.log('ℹ️ Nota: Se o erro for sobre o valor já existir, ignore.');
    console.error('❌ Erro:', err.message);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

run();
