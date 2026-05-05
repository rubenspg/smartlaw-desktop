import { db } from '../apps/server/src/db';
import { firms, profiles, clientes, processosJudiciais, tarefas, andamentos } from '../apps/server/src/db/schema';
import { eq } from 'drizzle-orm';

async function dummySeed() {
  console.log('🌱 Gerando dados fictícios para teste...');

  const [firm] = await db.select().from(firms).limit(1);
  const [admin] = await db.select().from(profiles).where(eq(profiles.email, 'admin@smartlaw.local')).limit(1);

  if (!firm || !admin) {
    console.error('❌ Firma ou Admin não encontrados. Rode o seed básico primeiro.');
    return;
  }

  // 1. Cliente
  const [cliente] = await db.insert(clientes).values({
    firmId: firm.id,
    tipo: 'F',
    nome: 'Mateus Teste AI',
    cpfCnpj: '123.456.789-00',
    email: 'mateus@teste.com',
    situacao: 'A',
  }).returning();
  console.log('✅ Cliente teste criado');

  // 2. Processo
  const [processo] = await db.insert(processosJudiciais).values({
    firmId: firm.id,
    clienteId: cliente.id,
    numero: '5001234-56.2024.8.24.0000',
    situacao: 'EM ANDAMENTO',
    comarca: 'Florianópolis',
    justica: 'Estadual',
  }).returning();
  console.log('✅ Processo teste criado');

  // 3. Andamento
  await db.insert(andamentos).values({
    firmId: firm.id,
    processoJudicialId: processo.id,
    data: new Date(),
    inclusao: new Date(),
    historico: 'Petição inicial protocolada com sucesso.',
    tipo: 'MANUAL',
  });
  console.log('✅ Andamento teste criado');

  // 4. Tarefa
  await db.insert(tarefas).values({
    firmId: firm.id,
    usuarioId: admin.id,
    clienteId: cliente.id,
    processoJudicialId: processo.id,
    titulo: 'Revisar petição do Mateus',
    descricao: 'Verificar se todos os documentos foram anexados conforme a nova regra da IA.',
    dataLimite: new Date(Date.now() + 86400000), // amanhã
    prioridade: 'ALTA',
    status: 'PENDENTE',
  });
  console.log('✅ Tarefa teste criada');

  console.log('🚀 Tudo pronto! Agora a Dashboard deve exibir dados.');
  process.exit(0);
}

dummySeed().catch(console.error);
