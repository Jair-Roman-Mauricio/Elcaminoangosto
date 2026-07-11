import { Redis } from 'ioredis'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
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
  const sql = postgres(config.DATABASE_URL, { prepare: false, max: 4 })

  const provider = new SupabaseMediaProvider(supabase)

  const worker = crearMediaWorker({
    connection,
    provider,
    logger,
    concurrency: config.MEDIA_CONCURRENCY,
    alTerminar: async (assetId, resultado) => {
      if (resultado.ok) {
        await sql`
          update public.media_assets
          set status = 'READY',
              poster_path = ${resultado.posterPath},
              hls_path = ${resultado.hlsPath},
              duration_seconds = ${resultado.durationSeconds},
              updated_at = now()
          where id = ${assetId}`
        logger.info({ assetId }, 'media_assets → READY')
      } else {
        await sql`
          update public.media_assets
          set status = 'FAILED', updated_at = now()
          where id = ${assetId}`
        logger.error({ assetId, reason: resultado.reason }, 'media_assets → FAILED')
      }
    },
  })

  logger.info({ provider: provider.nombre, concurrency: config.MEDIA_CONCURRENCY }, 'Worker arriba')

  const apagar = async (senal: string): Promise<void> => {
    logger.info({ senal }, 'Apagando worker')
    await worker.close()
    await sql.end({ timeout: 5 })
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
