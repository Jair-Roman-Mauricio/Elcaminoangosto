import { Redis } from 'ioredis'
import { createClient } from '@supabase/supabase-js'
import { Pool } from 'pg'
import pino from 'pino'
import { cargarConfig } from './config'
import { SupabaseMediaProvider } from './media/supabase-media-provider'
import { crearMediaWorker } from './media/media.worker'

async function main(): Promise<void> {
  const config = cargarConfig()

  const logger = pino({
    level: config.LOG_LEVEL,
    ...(config.NODE_ENV !== 'production' ? { transport: { target: 'pino-pretty' } } : {}),
  })

  // BullMQ exige `maxRetriesPerRequest: null` en la conexión del worker.
  const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null })

  // La service key solo vive en el worker y en el API, nunca en el navegador.
  //
  // `createClient` construye siempre un RealtimeClient, que exige `WebSocket`
  // nativo. Por eso este proceso requiere Node 22+ aunque solo use Storage.
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // El worker escribe el resultado directamente en `media_assets`. No comparte
  // el EventEmitter del API (proceso aparte): la BD es la fuente de verdad, y
  // el feed muestra un post solo cuando su media_asset está READY.
  // `pg` y no `postgres.js` por lo mismo que el API: con el pooler de Supabase
  // aquel se queda con conexiones que envían la consulta y no reciben respuesta
  // jamás, y no ofrece ningún plazo del lado del cliente. Aquí el precio de esa
  // avería es callado y peor: el video se transcodifica bien, el resultado no
  // se puede escribir, y el medio se queda en «procesando» para siempre.
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 4,
    query_timeout: 15_000,
    statement_timeout: 15_000,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
  })
  // Un error en una conexión ociosa es un `error` sin escuchar: tumba el proceso.
  pool.on('error', (error) => logger.warn({ err: error }, 'Conexión descartada del pool'))

  const provider = new SupabaseMediaProvider(supabase)

  const worker = crearMediaWorker({
    connection,
    provider,
    logger,
    concurrency: config.MEDIA_CONCURRENCY,
    alTerminar: async (assetId, resultado) => {
      if (resultado.ok) {
        await pool.query(
          `update public.media_assets
             set status = 'READY',
                 poster_path = $1,
                 hls_path = $2,
                 duration_seconds = $3,
                 updated_at = now()
           where id = $4`,
          [resultado.posterPath, resultado.hlsPath, resultado.durationSeconds, assetId],
        )
        logger.info({ assetId }, 'media_assets → READY')
      } else {
        await pool.query(
          `update public.media_assets
             set status = 'FAILED', updated_at = now()
           where id = $1`,
          [assetId],
        )
        logger.error({ assetId, reason: resultado.reason }, 'media_assets → FAILED')
      }
    },
  })

  logger.info({ provider: provider.nombre, concurrency: config.MEDIA_CONCURRENCY }, 'Worker arriba')

  const apagar = async (senal: string): Promise<void> => {
    logger.info({ senal }, 'Apagando worker')
    await worker.close()
    await pool.end()
    await connection.quit()
    process.exit(0)
  }

  process.on('SIGTERM', () => void apagar('SIGTERM'))
  process.on('SIGINT', () => void apagar('SIGINT'))
}

main().catch((error: unknown) => {
  console.error('El worker no pudo arrancar:', error)
  process.exit(1)
})
