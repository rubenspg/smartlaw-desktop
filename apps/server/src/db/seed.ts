import { db } from './index';
import { eq } from 'drizzle-orm';
import { firms, profiles, especiesProcesso, tiposAcao, ritosProcessuais, localizacoesProcesso, posicoesParte, municipios } from './schema';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { parse } from 'csv-parse/sync';
import { ensureLookupDefaults } from './lookup-defaults';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DADOS_DIR = process.env.CSV_DATA_DIR ?? path.resolve(__dirname, '../../../../../smartlaw/dados_sistema/dados_csv');

// Os CSVs legados não estão no repositório: o caminho padrão só existe na
// máquina original. Fora dela o seed continua válido, mas as tabelas de
// domínio vêm dos defaults — e isso precisa ficar explícito no fim da execução,
// senão o seed "passa" e a aplicação sobe com selects vazios.
const TOTAL_CSVS = 6;
const csvsAusentes: string[] = [];

function readCsv(filename: string): Record<string, string>[] {
  const filePath = path.join(DADOS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    csvsAusentes.push(filename);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('_codigo') || line.includes('código') || line.includes('aer_') || line.includes('aed_') || line.includes('aef_') || line.includes('aej_') || line.includes('aeh_')) {
      headerIndex = i;
      break;
    }
  }

  const csvContent = lines.slice(headerIndex).join('\n');
  try {
    return parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
      delimiter: [',', ';'],
    }) as Record<string, string>[];
  } catch (err: any) {
    console.error(`  ❌ Erro ao processar CSV ${filename}:`, err.message);
    return [];
  }
}

function relatarCsvsAusentes(registrosPadrao: number) {
  if (csvsAusentes.length === 0) return;

  const todos = csvsAusentes.length === TOTAL_CSVS;
  const cabecalho = todos
    ? 'Nenhum CSV legado foi encontrado.'
    : `${csvsAusentes.length} de ${TOTAL_CSVS} CSVs legados não foram encontrados:\n` +
      csvsAusentes.map((f) => `     - ${f}`).join('\n');

  const municipiosVazio = csvsAusentes.includes('tabela_municipios.csv');

  console.log(`
────────────────────────────────────────────────────────────────
⚠️  ${cabecalho}

   Procurado em: ${DADOS_DIR}
   (configurável via CSV_DATA_DIR)

   Isso é esperado fora da máquina original — os CSVs não fazem
   parte do repositório. As tabelas de domínio foram preenchidas
   com valores padrão (${registrosPadrao} registros), suficientes para
   rodar a aplicação em desenvolvimento.${
     municipiosVazio
       ? `

   A tabela 'municipios' NÃO tem valores padrão e ficou vazia:
   campos de município e comarca aparecerão sem opções até que
   você aponte CSV_DATA_DIR para os dados reais.`
       : ''
   }
────────────────────────────────────────────────────────────────`);
}

function str(val: string | undefined | null): string | null {
  if (!val) return null;
  const cleaned = val.trim();
  if (cleaned === '') return null;
  return cleaned;
}

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create default firm
  const [firm] = await db.insert(firms).values({
    nome: 'Escritório SmartLaw',
  }).onConflictDoUpdate({
    target: firms.nome,
    set: { nome: 'Escritório SmartLaw' }
  }).returning();

  console.log(`✅ Firm created: ${firm.nome} (${firm.id})`);

  // 2. Create default admin.
  // Nunca use uma senha padrão fixa: contas admin de produção já ficaram
  // acessíveis com a senha pública do repositório. Lê de SEED_ADMIN_PASSWORD;
  // sem isso, gera uma aleatória e a imprime uma única vez.
  //
  // O upsert abaixo não redefine passwordHash, então num re-seed a senha
  // continua sendo a antiga. Verificamos antes de gerar: imprimir uma senha
  // que não foi aplicada faz o dev anotar uma credencial que não funciona.
  const adminJaExiste = !!(await db.query.profiles.findFirst({
    where: eq(profiles.email, 'admin@smartlaw.local'),
  }));

  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD || randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  if (adminJaExiste) {
    console.log('ℹ️  Admin já existe: senha mantida como está (re-seed não redefine senha).');
  } else if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`⚠️  Senha de admin gerada (anote agora, não será mostrada de novo): ${adminPassword}`);
  }
  const [admin] = await db.insert(profiles).values({
    ...(process.env.NODE_ENV !== 'production' ? { id: '00000000-0000-0000-0000-000000000000' } : {}),
    nome: 'Admin',
    email: 'admin@smartlaw.local',
    passwordHash: passwordHash,
    perfil: 'admin',
    firmId: firm.id,
  }).onConflictDoUpdate({
    target: profiles.email,
    // Não redefinir passwordHash aqui: re-seedar não deve sobrescrever a senha
    // de um admin já existente (foi assim que a senha padrão persistiu em prod).
    set: { nome: 'Admin', perfil: 'admin', firmId: firm.id }
  }).returning();

  console.log(`✅ Admin ready: ${admin.email}`);

  // 3. Seed municipios
  console.log('  Seeding municipios...');
  const municipiosRows = readCsv('tabela_municipios.csv');
  const municipiosData = municipiosRows.map(row => ({
    codigo: str(row['Código'] || row['Codigo']),
    nome: str(row['Nome']) ?? 'Não informado',
    cepInicial: str(row['CEP Inicial']),
    cepFinal: str(row['CEP Final']),
    estado: str(row['Estado']),
    pais: str(row['Pais']),
    codIbge: str(row['Cód. Ibge'] || row['Cod. Ibge']),
    comarca: str(row['Comarca']),
  })).filter((r): r is any => !!r.codigo);

  if (municipiosData.length > 0) {
    // Split into chunks of 1000
    for (let i = 0; i < municipiosData.length; i += 1000) {
      const chunk = municipiosData.slice(i, i + 1000);
      await db.insert(municipios).values(chunk).onConflictDoNothing();
    }
    console.log(`    ✓ ${municipiosData.length} municípios`);
  }

  // 4. Seed Lookups
  const lookupFiles = [
    { file: 'tabela_especies_processo.csv', table: especiesProcesso, code: 'aer_codigo', desc: 'aer_descricao' },
    { file: 'tabela_tipo_acoes.csv', table: tiposAcao, code: 'aed_codigo', desc: 'aed_descricao' },
    { file: 'tabela_ritos_processuais.csv', table: ritosProcessuais, code: 'aef_codigo', desc: 'aef_descricao' },
    { file: 'tabela_localizacao_processo.csv', table: localizacoesProcesso, code: 'aej_codigo', desc: 'aej_descricao' },
    { file: 'tabela_posicoes_partes.csv', table: posicoesParte, code: 'aeh_codigo', desc: 'aeh_descricao' },
  ];

  for (const item of lookupFiles) {
    console.log(`  Seeding ${item.file}...`);
    const rows = readCsv(item.file);
    const records = rows.map(row => ({
      codigo: str(row[item.code]),
      descricao: str(row[item.desc]) ?? 'Não informado'
    })).filter((r): r is any => !!r.codigo);

    if (records.length > 0) {
      await db.insert(item.table).values(records).onConflictDoNothing();
      console.log(`    ✓ ${records.length} records`);
    }
  }

  // 5. Defaults para as tabelas de lookup que os CSVs legados não preencheram
  const registrosPadrao = await ensureLookupDefaults();

  relatarCsvsAusentes(registrosPadrao);

  console.log('✅ Seed completed!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
