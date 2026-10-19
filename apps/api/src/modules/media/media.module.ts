import { Module } from '@nestjs/common'
import { MediaController } from './interface/media.controller'
import { MediaService } from './application/media.service'
import { MediaRepository } from './domain/media.repository'
import { MediaStoragePort, MediaQueuePort } from './domain/media-storage.port'
import { DrizzleMediaRepository } from './infrastructure/drizzle-media.repository'
import { S3StorageAdapter } from './infrastructure/s3-storage.adapter'
import { FilesController } from './interface/files.controller'
import { BullmqQueueAdapter } from './infrastructure/bullmq-queue.adapter'

/**
 * Bounded context `media`: ingesta (subida por el API al bucket S3), transcodificación
 * asíncrona (delegada al worker por BullMQ) y entrega por URL firmada.
 * Exporta MediaService para que feed/discipleship firmen URLs sin conocer el almacenamiento.
 */
@Module({
  controllers: [MediaController, FilesController],
  providers: [
    MediaService,
    { provide: MediaRepository, useClass: DrizzleMediaRepository },
    { provide: MediaStoragePort, useClass: S3StorageAdapter },
    { provide: MediaQueuePort, useClass: BullmqQueueAdapter },
  ],
  exports: [MediaService],
})
export class MediaModule {}
