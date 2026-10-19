/**
 * Aplica las migraciones de `db/migrations/*.sql`, en orden y una sola vez cada
 * una (se anotan en `public.schema_migrations`). Corre antes de arrancar el API, así
 * el código nuevo nunca encuentra un esquema viejo.
 *
 * Una base que ya traía el esquema base (cargada desde el volcado de Supabase)
 * se reconoce porque existe `public.profiles`: la 0001 se anota sin ejecutarse.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

const DIR = join(__dirname, '..', '..', '..', 'db', 'migrations')

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Falta DATABASE_URL')

  const db = new Client({ connectionString: url })
  await db.connect()
  try {
    // Un solo migrador a la vez aunque haya varias réplicas arrancando.
    await db.query('select pg_advisory_lock(727274)')
    await db.query(
      'create table if not exists public.schema_migrations (nombre text primary key, aplicada_en timestamptz not null default now())',
    )
    await db.query("set search_path to public")
    const hechas = new Set(
      (await db.query<{ nombre: string }>('select nombre from public.schema_migrations')).rows.map((r) => r.nombre),
    )
    const archivos = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()

    for (const archivo of archivos) {
      if (hechas.has(archivo)) continue

      if (archivo.startsWith('0001_')) {
        const { rows } = await db.query("select to_regclass('public.profiles') as t")
        if (rows[0]?.t) {
          await db.query('insert into public.schema_migrations (nombre) values ($1)', [archivo])
          console.log(`· ${archivo}: el esquema ya existía; se anota sin ejecutar`)
          continue
        }
      }

      console.log(`→ ${archivo}`)
      await db.query('begin')
      try {
        await db.query(readFileSync(join(DIR, archivo), 'utf8'))
        await db.query('insert into public.schema_migrations (nombre) values ($1)', [archivo])
        await db.query('commit')
      } catch (error) {
        await db.query('rollback')
        throw error
      }
    }
    console.log('✓ Migraciones al día')
  } finally {
    await db.end()
  }
}

main().catch((error: unknown) => {
  console.error('Falló la migración:', error)
  process.exit(1)
})
