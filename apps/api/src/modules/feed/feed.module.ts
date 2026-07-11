import { Module } from '@nestjs/common'
import { FeedController } from './interface/feed.controller'
import { FeedService } from './application/feed.service'
import { PostRepository } from './domain/post.repository'
import { DrizzlePostRepository } from './infrastructure/drizzle-post.repository'
import { MediaModule } from '../media'

/**
 * Bounded context `feed` (Tarjetas de Fe). Publicación y feed vertical.
 * Usa el servicio público de `media` para firmar URLs; no conoce el SDK de
 * Storage ni el esquema de media_assets más allá de su servicio.
 */
@Module({
  imports: [MediaModule],
  controllers: [FeedController],
  providers: [
    FeedService,
    { provide: PostRepository, useClass: DrizzlePostRepository },
  ],
  exports: [FeedService],
})
export class FeedModule {}
