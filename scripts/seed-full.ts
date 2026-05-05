import { db } from '../apps/server/src/db';
import { firms, profiles, clientes, processosJudiciais, tarefas, andamentos } from '../apps/server/src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function fullSeed() {
  console.log('🚀 Gerando massa de dados completa...');

  const [firm] = await db.select().from(firms).limit(1);
  if (!firm) {
    console.error('❌ Firma não encontrada.');
    return;
  }

  const passwordHash = await bcrypt.hash('changeme', 10);

  // 1. Criar Usuários
  const usersToCreate = [
    { nome: 'Mateus Advogado', email: 'mateus@smartlaw.local', perfil: 'usuario' as const },
    { nome: 'Rubens Admin', email: 'rubens@smartlaw.local', perfil: 'admin' as const },
    { nome: 'Auxiliar Administrativo', email: 'apoio@smartlaw.local', perfil: 'administrativo' as const },
  ];

  for (const u of usersToCreate) {
    await db.insert(profiles).values({
      nome: u.nome,
      email: u.email,
      passwordHash,
      perfil: u.perfil,
      firmId: firm.id,
      ativo: true,
    }).onConflictDoNothing();
  }
  console.log('✅ Usuários criados (Senha padrão: changeme)');

  // 2. Criar Vários Clientes
  const nomesClientes = [
    'João da Silva', 'Maria Oliveira', 'Empresa Tech Ltda', 'Condomínio Solar', 
    'Carlos Souza', 'Fernanda Lima', 'Roberto Carlos', 'Juliana Paes'
  ];

  const createdClientes = [];
  for (const nome of nomesClientes) {
    const [c] = await db.insert(clientes).values({
      firmId: firm.id,
      tipo: nome.includes('Ltda') || nome.includes('Condomínio') ? 'J' : 'F',
      nome,
      cpfCnpj: Math.random().toString().slice(2, 13),
      email: `${nome.toLowerCase().replace(/ /g, '.')}@email.com`,
      situacao: 'A',
      profissao: 'Consultor',
    }).returning();
    createdClientes.push(c);
  }
  console.log('✅ 8 Clientes criados');

  // 3. Criar Processos e Andamentos
  for (let i = 0; i < 5; i++) {
    const [proc] = await db.insert(processosJudiciais).values({
      firmId: firm.id,
      clienteId: createdClientes[i].id,
      numero: `500${Math.floor(Math.random() * 90000 + 10000)}-${Math.floor(Math.random() * 90 + 10)}.2024.8.24.000${i}`,
      situacao: i % 2 === 0 ? 'EM ANDAMENTO' : 'SUSPENSO',
      comarca: 'Joinville',
    }).returning();

    await db.insert(andamentos).values({
      firmId: firm.id,
      processoJudicialId: proc.id,
      data: new Date(),
      inclusao: new Date(),
      historico: 'Movimentação automática detectada pelo sistema.',
      tipo: 'SISTEMA',
    });
  }
  console.log('✅ 5 Processos e andamentos criados');

  // 4. Criar Várias Tarefas
  const [mateusUser] = await db.select().from(profiles).where(eq(profiles.email, 'mateus@smartlaw.local')).limit(1);
  
  const titulosTarefas = [
    'Audiência de Conciliação', 'Protocolar Réplica', 'Ligar para o cliente', 
    'Pagar custas processuais', 'Analisar sentença'
  ];

  for (let i = 0; i < titulosTarefas.length; i++) {
    await db.insert(tarefas).values({
      firmId: firm.id,
      usuarioId: mateusUser.id,
      clienteId: createdClientes[i].id,
      titulo: titulosTarefas[i],
      dataLimite: new Date(Date.now() + (i - 1) * 86400000), // Algumas atrasadas, algumas hoje, algumas futuro
      prioridade: i === 0 ? 'ALTA' : 'MEDIA',
      status: 'PENDENTE',
    });
  }
  console.log('✅ 5 Tarefas criadas para o Mateus');

  console.log('\n✨ Massa de dados pronta!');
  console.log('LOGINS DISPONÍVEIS (Senha: changeme):');
  console.log('- mateus@smartlaw.local (Advogado)');
  console.log('- rubens@smartlaw.local (Admin)');
  console.log('- apoio@smartlaw.local (Administrativo)');
  process.exit(0);
}

fullSeed().catch(console.error);
