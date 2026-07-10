import { Redis } from 'ioredis'
import { createClient } from '@supabase/supabase-js'
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
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const provider = new SupabaseMediaProvider(supabase)

  const worker = crearMediaWorker({
    connection,
    provider,
    logger,
    concurrency: config.MEDIA_CONCURRENCY,
    alTerminar: async (assetId, resultado) => {
      // TODO(S3 · HU-8.2): actualizar `media_assets` y emitir MediaAssetReady/Failed.
      logger.info({ assetId, resultado }, 'Resultado de transcodificación (persistencia pendiente)')
    },
  })

  logger.info({ provider: provider.nombre, concurrency: config.MEDIA_CONCURRENCY }, 'Worker arriba')

  const apagar = async (senal: string): Promise<void> => {
    logger.info({ senal }, 'Apagando worker')
    await worker.close()
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
