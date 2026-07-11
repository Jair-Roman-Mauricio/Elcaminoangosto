import { Module } from '@nestjs/common'
import { MediaController } from './interface/media.controller'
import { MediaService } from './application/media.service'
import { MediaRepository } from './domain/media.repository'
import { MediaStoragePort, MediaQueuePort } from './domain/media-storage.port'
import { DrizzleMediaRepository } from './infrastructure/drizzle-media.repository'
import { SupabaseStorageAdapter } from './infrastructure/supabase-storage.adapter'
import { BullmqQueueAdapter } from './infrastructure/bullmq-queue.adapter'

/**
 * Bounded context `media`: ingesta (subida reanudable), transcodificación
 * asíncrona (delegada al worker por BullMQ) y entrega por URL firmada.
 * Exporta MediaService para que feed/discipleship firmen URLs sin conocer el SDK.
 */
@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    { provide: MediaRepository, useClass: DrizzleMediaRepository },
    { provide: MediaStoragePort, useClass: SupabaseStorageAdapter },
    { provide: MediaQueuePort, useClass: BullmqQueueAdapter },
  ],
  exports: [MediaService],
})
export class MediaModule {}
