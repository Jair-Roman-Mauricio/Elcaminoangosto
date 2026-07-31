import { Module } from '@nestjs/common'
import { VideosController } from './interface/videos.controller'
import { VideosService } from './application/videos.service'
import { VideoRepository } from './domain/video.repository'
import { DrizzleVideoRepository } from './infrastructure/drizzle-video.repository'
import { MediaModule } from '../media'

/**
 * Bounded context `videos` (HU-9.3): catálogo de videos cristianos que el
 * ADMIN publica y administra desde el módulo Contenido.
 *
 * Usa el servicio público de `media` para firmar URLs; no conoce el SDK de
 * Storage ni el esquema de `media_assets`.
 */
@Module({
  imports: [MediaModule],
  controllers: [VideosController],
  providers: [VideosService, { provide: VideoRepository, useClass: DrizzleVideoRepository }],
  exports: [VideosService],
})
export class VideosModule {}
