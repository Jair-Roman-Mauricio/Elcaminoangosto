import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { MediaQueuePort } from '../domain/media-storage.port'

/** Nombre de la cola. Debe coincidir con el consumidor del worker. */
const COLA_MEDIA = 'media'

/**
 * Productor BullMQ. Encola la transcodificación; el worker (proceso aparte) la
 * consume. Si no hay `REDIS_URL`, encolar es un no-op con aviso: el API sigue
 * arrancando en entornos sin Redis (p. ej. CI de build).
 */
@Injectable()
export class BullmqQueueAdapter
  extends MediaQueuePort
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(BullmqQueueAdapter.name)
  private queue: Queue | null = null
  private connection: Redis | null = null

  constructor(private readonly config: ConfigService) {
    super()
  }

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL')
    if (!url) {
      this.logger.warn('Sin REDIS_URL: la transcodificación no se encolará.')
      return
    }
    this.connection = new Redis(url, { maxRetriesPerRequest: null })
    this.queue = new Queue(COLA_MEDIA, { connection: this.connection })
  }

  async enqueueTranscode(input: {
    assetId: string
    bucket: string
    path: string
    kind: 'AUDIO' | 'VIDEO' | 'IMAGE'
  }): Promise<void> {
    if (!this.queue) {
      this.logger.warn(`Cola no disponible; no se encola el asset ${input.assetId}`)
      return
    }
    await this.queue.add('transcode', input, {
      jobId: input.assetId, // idempotente: un asset se procesa una vez
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
    })
    this.logger.log(`Encolado asset ${input.assetId} (${input.kind})`)
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue?.close()
    await this.connection?.quit()
  }
}
