/**
 * Migrates user profiles from Supabase to the desktop PostgreSQL instance.
 *
 * Supabase stores credentials in the internal `auth.users` table, which is not
 * accessible through the public schema. This script connects directly to the
 * Supabase Postgres port (54322) to JOIN `auth.users` with `public.profiles`,
 * then inserts each profile into the target DB with a placeholder password hash.
 * Users must reset their password on first login.
 *
 * Usage:
 *   npx tsx scripts/migrate-profiles.ts [--dry-run]
 *
 * Environment variables (all optional, fall back to defaults for local dev):
 *   SOURCE_URL   — Supabase Postgres URL  (default: postgresql://postgres:postgres@localhost:54322/postgres)
 *   TARGET_URL   — Desktop Postgres URL   (default: postgresql://smartlaw:smartlaw-pass@localhost:5432/smartlaw)
 *   PLACEHOLDER_PASSWORD — Plain-text password to hash for all migrated users (default: RESET_REQUIRED)
 */

import postgres from 'postgres'
import bcrypt from 'bcryptjs'

const SOURCE_URL = process.env.SOURCE_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres'
const TARGET_URL = process.env.TARGET_URL ?? 'postgresql://smartlaw:smartlaw-pass@localhost:5432/smartlaw'
const PLACEHOLDER_PASSWORD = process.env.PLACEHOLDER_PASSWORD ?? 'RESET_REQUIRED'
const DRY_RUN = process.argv.includes('--dry-run')

if (DRY_RUN) {
  console.log('🔍 DRY RUN — no data will be written to the target database\n')
}

const source = postgres(SOURCE_URL, { max: 1 })
const target = postgres(TARGET_URL, { max: 1 })

async function run() {
  // Verify source connection
  try {
    await source`SELECT 1`
    console.log('✅ Connected to source (Supabase Postgres)')
  } catch (err) {
    console.error('❌ Cannot connect to source DB:', SOURCE_URL)
    console.error('   Is Supabase running? Run: supabase start')
    process.exit(1)
  }

  // Verify target connection
  try {
    await target`SELECT 1`
    console.log('✅ Connected to target (Desktop Postgres)')
  } catch (err) {
    console.error('❌ Cannot connect to target DB:', TARGET_URL)
    console.error('   Is Docker running? Run: docker compose up -d')
    process.exit(1)
  }

  // Check that target `profiles` table exists
  const tableCheck = await target`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  `
  if (tableCheck.length === 0) {
    console.error('❌ Target `profiles` table not found. Run migrations first:')
    console.error('   npm run --prefix apps/server db:migrate')
    process.exit(1)
  }

  // Fetch profiles + emails from Supabase
  console.log('\n📥 Fetching profiles from Supabase...')
  const rows = await source`
    SELECT
      p.id,
      p.nome,
      u.email,
      p.perfil,
      p.ativo,
      p.firm_id,
      p.created_at,
      p.updated_at
    FROM  public.profiles p
    JOIN  auth.users      u ON u.id = p.id
    ORDER BY p.created_at
  `

  if (rows.length === 0) {
    console.log('⚠️  No profiles found in source database. Nothing to migrate.')
    return
  }

  console.log(`   Found ${rows.length} profile(s)`)

  // Verify every profile's firm_id exists in the target
  const firmIds = [...new Set(rows.map(r => r.firm_id).filter(Boolean))]
  const existingFirms = await target`
    SELECT id FROM firms WHERE id = ANY(${firmIds})
  `
  const existingFirmIds = new Set(existingFirms.map(f => f.id))
  const missingFirms = firmIds.filter(id => !existingFirmIds.has(id))

  if (missingFirms.length > 0) {
    if (DRY_RUN) {
      console.warn('\n⚠️  [dry-run] The following firm_id values are not yet in the target (expected — Step 2 is also a dry-run):')
      missingFirms.forEach(id => console.warn(`   ${id}`))
    } else {
      console.error('\n❌ The following firm_id values are referenced by profiles but do not exist in the target:')
      missingFirms.forEach(id => console.error(`   ${id}`))
      console.error('\n   Fix: run Step 2 (firm UUID preservation) from the migration guide before this script.')
      process.exit(1)
    }
  }

  // Generate placeholder hash once — same hash for all users
  console.log('\n🔐 Generating placeholder password hash...')
  const placeholderHash = await bcrypt.hash(PLACEHOLDER_PASSWORD, 10)

  // Insert into target
  console.log('📤 Inserting profiles into target...\n')

  let inserted = 0
  let skipped = 0

  for (const row of rows) {
    if (DRY_RUN) {
      console.log(`   [dry-run] Would insert: ${row.email} (${row.perfil})`)
      inserted++
      continue
    }

    const result = await target`
      INSERT INTO profiles
        (id, nome, email, password_hash, perfil, ativo, firm_id, created_at, updated_at)
      VALUES
        (${row.id}, ${row.nome}, ${row.email}, ${placeholderHash},
         ${row.perfil ?? 'usuario'}, ${row.ativo ?? true}, ${row.firm_id},
         ${row.created_at}, ${row.updated_at})
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `

    if (result.length > 0) {
      console.log(`   ✅ ${row.email} (${row.perfil})`)
      inserted++
    } else {
      console.log(`   ⏭️  ${row.email} — already exists, skipped`)
      skipped++
    }
  }

  // Summary
  console.log('\n─────────────────────────────────────────')
  if (DRY_RUN) {
    console.log(`🔍 Dry run complete. ${inserted} profile(s) would be inserted.`)
  } else {
    console.log(`✅ Migration complete.`)
    console.log(`   Inserted : ${inserted}`)
    console.log(`   Skipped  : ${skipped} (already existed)`)
    console.log(`   Total    : ${rows.length}`)
    console.log(`\n⚠️  All migrated users have a placeholder password.`)
    console.log(`   Placeholder: "${PLACEHOLDER_PASSWORD}"`)
    console.log(`   Users must reset their password on first login.`)
  }
}

run()
  .catch(err => {
    console.error('\n❌ Unexpected error:', err.message)
    process.exit(1)
  })
  .finally(async () => {
    await source.end()
    await target.end()
  })
