import { db } from './index';
import { firms, profiles, especiesProcesso, tiposAcao, ritosProcessuais, localizacoesProcesso, posicoesParte, municipios } from './schema';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DADOS_DIR = process.env.CSV_DATA_DIR ?? path.resolve(__dirname, '../../../../../smartlaw/dados_sistema/dados_csv');

function readCsv(filename: string): Record<string, string>[] {
  const filePath = path.join(DADOS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️ Arquivo não encontrado: ${filename}`);
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

  // 2. Create default admin
  const passwordHash = await bcrypt.hash('changeme', 10);
  const [admin] = await db.insert(profiles).values({
    ...(process.env.NODE_ENV !== 'production' ? { id: '00000000-0000-0000-0000-000000000000' } : {}),
    nome: 'Admin',
    email: 'admin@smartlaw.local',
    passwordHash: passwordHash,
    perfil: 'admin',
    firmId: firm.id,
  }).onConflictDoUpdate({
    target: profiles.email,
    set: { nome: 'Admin', passwordHash, perfil: 'admin', firmId: firm.id }
  }).returning();

  console.log(`✅ Admin created: ${admin.email}`);

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

  console.log('✅ Seed completed!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
