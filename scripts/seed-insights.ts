import { db } from '../apps/server/src/db';
import { firms, profiles, clientes, processosJudiciais, tarefas, honorarios } from '../apps/server/src/db/schema';
import { eq } from 'drizzle-orm';

async function seedInsights() {
  console.log('📊 Gerando dados ricos para o Dashboard (Insights)...');

  const [firm] = await db.select().from(firms).limit(1);
  if (!firm) {
    console.error('❌ Firma não encontrada. Rode o seed inicial primeiro.');
    return;
  }

  const [mateus] = await db.select().from(profiles).where(eq(profiles.email, 'mateus@smartlaw.local')).limit(1);
  if (!mateus) {
    console.error('❌ Usuário Mateus não encontrado.');
    return;
  }

  const currentYear = new Date().getFullYear();
  const comarcas = ['Joinville', 'Florianópolis', 'Blumenau', 'Itajaí', 'Curitiba', 'São Paulo'];
  const situacoes = ['EM ANDAMENTO', 'SUSPENSO', 'ARQUIVADO', 'SENTENCIADO', 'INICIAL'];
  const profissoes = ['Advogado', 'Médico', 'Engenheiro', 'Professor', 'Vendedor', 'Empresário', 'Autônomo'];
  const cidades = ['Joinville', 'Florianópolis', 'Araquari', 'Jaraguá do Sul', 'São Bento do Sul'];

  // 1. Criar Clientes (Acumulados por mês)
  console.log('  -> Criando 40 clientes...');
  const createdClientes = [];
  for (let i = 0; i < 40; i++) {
    const month = Math.floor(Math.random() * 5); // 0 a 4 (Janeiro a Maio)
    const day = Math.floor(Math.random() * 28) + 1;
    const dataCadastro = new Date(currentYear, month, day);
    
    // Nascimento aleatório para demografia de idade (entre 20 e 80 anos)
    const birthYear = currentYear - (Math.floor(Math.random() * 60) + 20);
    const nascimento = `${birthYear}-05-10`;

    const [c] = await db.insert(clientes).values({
      firmId: firm.id,
      tipo: Math.random() > 0.8 ? 'J' : 'F',
      nome: `Cliente Insights ${i}`,
      cpfCnpj: Math.random().toString().slice(2, 13),
      profissao: profissoes[Math.floor(Math.random() * profissoes.length)],
      municipio: cidades[Math.floor(Math.random() * cidades.length)],
      dataCadastro: dataCadastro,
      nascimento: nascimento,
      situacao: 'A',
    }).returning();
    createdClientes.push(c);
  }

  // 2. Criar Processos Judiciais
  console.log('  -> Criando 60 processos judiciais...');
  for (let i = 0; i < 60; i++) {
    const cliente = createdClientes[Math.floor(Math.random() * createdClientes.length)];
    await db.insert(processosJudiciais).values({
      firmId: firm.id,
      clienteId: cliente.id,
      numero: `500${Math.floor(Math.random() * 90000 + 10000)}-${Math.floor(Math.random() * 90 + 10)}.${currentYear}.8.24.000${i % 9}`,
      situacao: situacoes[Math.floor(Math.random() * situacoes.length)],
      comarca: comarcas[Math.floor(Math.random() * comarcas.length)],
      dataCadastro: new Date(currentYear, Math.floor(Math.random() * 5), 1),
    });
  }

  // 3. Criar Honorários (Financeiro)
  console.log('  -> Criando 50 lançamentos financeiros...');
  for (let i = 0; i < 50; i++) {
    const cliente = createdClientes[Math.floor(Math.random() * createdClientes.length)];
    const month = Math.floor(Math.random() * 6); // Jan a Jun
    const day = Math.floor(Math.random() * 28) + 1;
    const status = Math.random() > 0.4 ? 'PAGO' : 'PENDENTE';
    const valor = (Math.random() * 5000 + 500).toFixed(2);
    
    // Se for pendente e o mês for passado, ele fica em atraso no gráfico
    const dataVenc = `${currentYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    await db.insert(honorarios).values({
      firmId: firm.id,
      clienteId: cliente.id,
      descricao: `Honorários Ref. Processo ${i}`,
      valor: valor,
      valorPago: status === 'PAGO' ? valor : '0',
      dataVenc: dataVenc,
      dataPagto: status === 'PAGO' ? dataVenc : null,
      status: status,
    });
  }

  // 4. Criar Tarefas
  console.log('  -> Criando 30 tarefas para Mateus...');
  for (let i = 0; i < 30; i++) {
    const cliente = createdClientes[Math.floor(Math.random() * createdClientes.length)];
    const dayDiff = Math.floor(Math.random() * 20) - 10; // -10 a +10 dias
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() + dayDiff);

    await db.insert(tarefas).values({
      firmId: firm.id,
      usuarioId: mateus.id,
      clienteId: cliente.id,
      titulo: `Tarefa de Teste ${i}`,
      prioridade: i % 3 === 0 ? 'ALTA' : i % 3 === 1 ? 'MEDIA' : 'BAIXA',
      status: i % 4 === 0 ? 'CONCLUIDA' : i % 4 === 1 ? 'EM_ANDAMENTO' : 'PENDENTE',
      dataLimite: dataLimite,
    });
  }

  console.log('✨ Dados gerados com sucesso! O dashboard agora deve estar bem preenchido.');
  process.exit(0);
}

seedInsights().catch(console.error);
