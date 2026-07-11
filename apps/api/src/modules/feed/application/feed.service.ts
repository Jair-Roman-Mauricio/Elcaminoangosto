import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DOMAIN_EVENTS } from '@elcamino/shared-types'
import { PostRepository, type PostEntity } from '../domain/post.repository'
import { MediaService } from '../../media'
import type { Actor } from '../../shared'

/** Tarjeta del feed con las URLs ya firmadas, lista para el cliente. */
export interface FeedCard {
  id: string
  authorName: string
  type: 'VIDEO' | 'IMAGE'
  caption: string | null
  /** URL firmada del video/imagen. */
  mediaUrl: string
  /** URL firmada del póster (para el primer fotograma / imagen de carga). */
  posterUrl: string | null
  publishedAt: string | null
}

/**
 * API pública del bounded context `feed` (Tarjetas de Fe).
 *
 * Un post solo aparece cuando su `media_asset` está READY (lo marca el worker):
 * la BD es la fuente de verdad, sin evento entre procesos. Al servir, se firman
 * URLs de corta vida para el medio privado (HU-8.3).
 */
@Injectable()
export class FeedService {
  constructor(
    private readonly posts: PostRepository,
    private readonly media: MediaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * HU-3.3 — publicar una Tarjeta de Fe. Publican MAESTRO y ADMIN (Q-2:
   * publicación directa + moderación posterior). El medio debe existir y ser
   * del autor; el post queda visible cuando el medio esté READY.
   */
  async publicar(
    actor: Actor,
    input: { mediaAssetId: string; caption: string | null },
  ): Promise<PostEntity> {
    if (actor.role === 'ESTUDIANTE') {
      throw new ForbiddenException('Solo maestros y admins publican tarjetas')
    }

    const asset = await this.media.estado(input.mediaAssetId)
    if (asset.ownerId !== actor.id && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Ese medio no es tuyo')
    }
    if (asset.kind !== 'VIDEO' && asset.kind !== 'IMAGE') {
      throw new BadRequestException('Una tarjeta de fe es un video o una imagen')
    }

    const post = await this.posts.create({
      authorId: actor.id,
      type: asset.kind,
      mediaAssetId: input.mediaAssetId,
      caption: input.caption,
    })

    this.events.emit(DOMAIN_EVENTS.POST_PUBLISHED, { postId: post.id, authorId: actor.id })
    return post
  }

  /**
   * HU-3.1 — feed vertical: tarjetas publicadas con medio READY, con URLs
   * firmadas. Cualquier usuario autenticado puede verlo.
   */
  async feed(limit: number, before: Date | null): Promise<FeedCard[]> {
    const filas = await this.posts.findFeed(Math.min(limit, 20), before)
    return Promise.all(
      filas.map(async (f) => ({
        id: f.id,
        authorName: f.authorName,
        type: f.type,
        caption: f.caption,
        // El feed es público para autenticados: `autorizado = true`.
        mediaUrl: await this.media.urlDeLectura(f.mediaAssetId, true),
        posterUrl: await this.media.urlDePoster(f.mediaAssetId, true),
        publishedAt: f.publishedAt?.toISOString() ?? null,
      })),
    )
  }
}
