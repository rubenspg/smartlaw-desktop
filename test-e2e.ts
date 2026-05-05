import { db } from './apps/server/src/db';
import { clientes, processosJudiciais } from './apps/server/src/db/schema';
import { eq } from 'drizzle-orm';
import { DatajudService } from './apps/server/src/services/DatajudService';
import { ComparisonService } from './apps/server/src/services/ComparisonService';

async function run() {
  const firmId = '26b3ee6b-9d16-4a3b-be14-f5554f86351f';
  const [cliente] = await db.insert(clientes).values({
    firmId,
    nome: 'Cliente Teste',
    tipo: 'F'
  }).returning();

  const [proc] = await db.insert(processosJudiciais).values({
    firmId,
    clienteId: cliente.id,
    numero: '1000000-00.2023.8.26.0000',
    situacao: 'ATIVO',
  }).returning();

  try {
    const remote = await DatajudService.fetchFromDatajud(proc.numero);
    console.log('Datajud Sync:', remote ? 'Success' : 'Not Found');
    if (remote) {
       const drift = ComparisonService.checkDrift(proc, remote);
       console.log('Drift info:', drift);
    }
  } catch(e) {
    console.error('Error fetching Datajud:', e);
  }

  process.exit(0);
}
run();
