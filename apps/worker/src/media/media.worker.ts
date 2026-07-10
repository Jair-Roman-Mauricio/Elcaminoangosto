import { Worker, type Job } from 'bullmq'
import type { Redis } from 'ioredis'
import type { Logger } from 'pino'
import { z } from 'zod'
import { COLA_MEDIA } from '../config'
import type { MediaProvider } from './media-provider'

/** Payload del job, emitido por el API al recibir `MediaUploadRequested`. */
export const TrabajoDeMedioSchema = z.object({
  assetId: z.string().uuid(),
  bucket: z.string().min(1),
  path: z.string().min(1),
  kind: z.enum(['AUDIO', 'VIDEO', 'IMAGE']),
})
export type TrabajoDeMedio = z.infer<typeof TrabajoDeMedioSchema>

export interface DepsDelWorker {
  connection: Redis
  provider: MediaProvider
  logger: Logger
  concurrency: number
  /** Marca el asset como READY/FAILED y emite el evento correspondiente. */
  alTerminar: (
    assetId: string,
    resultado:
      | { ok: true; hlsPath: string | null; posterPath: string | null; durationSeconds: number | null }
      | { ok: false; reason: string },
  ) => Promise<void>
}

/**
 * Consumidor de la cola `media` (HU-8.2).
 *
 * Los jobs pesados viven fuera del request (RNF-3). Reintentos con backoff
 * exponencial; al agotarlos, el asset queda `FAILED` y se notifica.
 */
export function crearMediaWorker(deps: DepsDelWorker): Worker<TrabajoDeMedio> {
  const { connection, provider, logger, concurrency, alTerminar } = deps

  const worker = new Worker<TrabajoDeMedio>(
    COLA_MEDIA,
    async (job: Job<TrabajoDeMedio>) => {
      const entrada = TrabajoDeMedioSchema.parse(job.data)
      logger.info({ jobId: job.id, ...entrada }, 'Transcodificando')

      const derivados = await provider.transcodificar(entrada)

      await alTerminar(entrada.assetId, { ok: true, ...derivados })
      return derivados
    },
    {
      connection,
      concurrency,
      // `removeOnFail: false` conserva los fallos para inspección manual.
      removeOnComplete: { count: 100 },
    },
  )

  worker.on('failed', (job, err) => {
    const intentos = job?.attemptsMade ?? 0
    const maximo = job?.opts.attempts ?? 1

    logger.error({ jobId: job?.id, intentos, maximo, err: err.message }, 'Job de medio falló')

    // Solo se marca FAILED cuando se agotaron los reintentos.
    if (job && intentos >= maximo) {
      void alTerminar(job.data.assetId, { ok: false, reason: err.message })
    }
  })

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, assetId: job.data.assetId }, 'Medio listo')
  })

  return worker
}
