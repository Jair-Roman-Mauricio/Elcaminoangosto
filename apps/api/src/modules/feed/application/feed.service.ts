import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DOMAIN_EVENTS } from '@elcamino/shared-types'
import {
  PostRepository,
  type PostEntity,
  type PostFicha,
  type PostStatus,
} from '../domain/post.repository'
import { MediaService } from '../../media'
import type { Actor } from '../../shared'

/** Tarjeta del feed con las URLs ya firmadas, lista para el cliente. */
export interface FeedCard {
  id: string
  authorName: string
  type: 'VIDEO' | 'IMAGE'
  caption: string | null
  /** Ficha del lienzo. Nula en tarjetas antiguas: el cliente la completa. */
  title: string | null
  manifesto: string | null
  story: string | null
  origin: string | null
  reference: string | null
  /** URL firmada del relato hablado, si la tarjeta lo tiene. */
  audioUrl: string | null
  /** URL firmada del video/imagen. */
  mediaUrl: string
  /** URL firmada del póster (para el primer fotograma / imagen de carga). */
  posterUrl: string | null
  publishedAt: string | null
}

/** Tarjeta como la ve el admin en el módulo Contenido. */
export interface AdminCard {
  id: string
  authorName: string
  type: 'VIDEO' | 'IMAGE'
  caption: string | null
  title: string | null
  manifesto: string | null
  /** El resto de la ficha, para poder corregirla sin volver a escribirla. */
  story: string | null
  origin: string | null
  reference: string | null
  status: PostStatus
  /** Estado del medio: explica por qué una tarjeta publicada aún no se ve. */
  mediaStatus: string
  posterUrl: string | null
  publishedAt: string | null
  createdAt: string
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
  private readonly logger = new Logger(FeedService.name)

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
    input: { mediaAssetId: string; caption: string | null } & Partial<PostFicha>,
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

    // El relato hablado es opcional, pero si viene debe ser audio y del autor.
    if (input.audioAssetId) {
      const audio = await this.media.estado(input.audioAssetId)
      if (audio.ownerId !== actor.id && actor.role !== 'ADMIN') {
        throw new ForbiddenException('Ese audio no es tuyo')
      }
      if (audio.kind !== 'AUDIO') {
        throw new BadRequestException('El relato de la tarjeta debe ser un audio')
      }
    }

    const post = await this.posts.create({
      authorId: actor.id,
      type: asset.kind,
      mediaAssetId: input.mediaAssetId,
      caption: input.caption,
      title: input.title ?? null,
      manifesto: input.manifesto ?? null,
      story: input.story ?? null,
      origin: input.origin ?? null,
      reference: input.reference ?? null,
      audioAssetId: input.audioAssetId ?? null,
    })

    this.events.emit(DOMAIN_EVENTS.POST_PUBLISHED, { postId: post.id, authorId: actor.id })
    return post
  }

  // ── Administración de contenido (HU-7.2, solo ADMIN) ──────────────────────

  /**
   * Todas las tarjetas para el módulo Contenido: publicadas, ocultas y las que
   * aún no tienen el medio listo. Se firma el póster para previsualizarlas sin
   * exponer el medio completo.
   */
  async listarParaAdmin(actor: Actor): Promise<AdminCard[]> {
    this.exigirAdmin(actor)
    const filas = await this.posts.findAllForAdmin()
    return Promise.all(
      filas.map(async (f) => ({
        id: f.id,
        authorName: f.authorName,
        type: f.type,
        caption: f.caption,
        title: f.title,
        manifesto: f.manifesto,
        story: f.story,
        origin: f.origin,
        reference: f.reference,
        status: f.status,
        mediaStatus: f.mediaStatus,
        // Una tarjeta sin procesar todavía no tiene póster: se muestra sin él.
        posterUrl: await this.media.urlDePoster(f.mediaAssetId, true).catch(() => null),
        publishedAt: f.publishedAt?.toISOString() ?? null,
        createdAt: f.createdAt.toISOString(),
      })),
    )
  }

  /**
   * Cambia la ficha de una tarjeta ya publicada.
   *
   * Solo los textos: el medio se queda donde está. Cambiar la imagen de una
   * tarjeta es publicar otra, y confundir las dos cosas deja tarjetas cuyo
   * relato no tiene nada que ver con lo que se ve.
   */
  async editar(
    actor: Actor,
    postId: string,
    cambios: { caption?: string | null | undefined } & {
      [K in keyof PostFicha]?: PostFicha[K] | undefined
    },
  ): Promise<PostEntity> {
    this.exigirAdmin(actor)
    const post = await this.posts.findById(postId)
    if (!post) throw new NotFoundException('Tarjeta no encontrada')
    return this.posts.updateFicha(postId, cambios)
  }

  /** Publica u oculta una tarjeta ya subida. */
  async cambiarEstado(actor: Actor, postId: string, status: PostStatus): Promise<PostEntity> {
    this.exigirAdmin(actor)
    const post = await this.posts.findById(postId)
    if (!post) throw new NotFoundException('Tarjeta no encontrada')
    if (post.status === status) {
      throw new BadRequestException('La tarjeta ya está en ese estado')
    }
    return this.posts.updateStatus(postId, status)
  }

  /**
   * Elimina la tarjeta y su medio. Primero la fila (referencia el asset por FK)
   * y después el archivo, como en el rechazo de un curso.
   */
  async eliminar(actor: Actor, postId: string): Promise<void> {
    this.exigirAdmin(actor)
    const post = await this.posts.findById(postId)
    if (!post) throw new NotFoundException('Tarjeta no encontrada')

    await this.posts.remove(postId)
    await this.media.eliminar(post.mediaAssetId)
  }

  private exigirAdmin(actor: Actor): void {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un admin administra el contenido publicado')
    }
  }

  /**
   * HU-3.1 — feed vertical: tarjetas publicadas con medio READY, con URLs
   * firmadas. Cualquier usuario autenticado puede verlo.
   */
  async feed(limit: number, before: Date | null): Promise<FeedCard[]> {
    const filas = await this.posts.findFeed(Math.min(limit, 20), before)
    const tarjetas = await Promise.all(
      filas.map(async (f) => {
        // Una tarjeta cuyo medio no se puede firmar —el archivo desapareció del
        // almacenamiento— se omite en vez de tumbar la página entera. Antes un
        // solo objeto perdido devolvía 500 y dejaba el feed en blanco.
        const mediaUrl = await this.media.urlDeLectura(f.mediaAssetId, true).catch(() => null)
        if (!mediaUrl) {
          this.logger.warn(
            { postId: f.id, mediaAssetId: f.mediaAssetId },
            'Tarjeta omitida del feed: no se pudo firmar su medio',
          )
          return null
        }

        return {
          id: f.id,
          authorName: f.authorName,
          type: f.type,
          caption: f.caption,
          title: f.title,
          manifesto: f.manifesto,
          story: f.story,
          origin: f.origin,
          reference: f.reference,
          audioUrl: f.audioAssetId
            ? await this.media.urlDeOrigen(f.audioAssetId, true).catch(() => null)
            : null,
          posterUrl: await this.media.urlDePoster(f.mediaAssetId, true).catch(() => null),
          publishedAt: f.publishedAt?.toISOString() ?? null,
          mediaUrl,
        }
      }),
    )
    return tarjetas.filter((t): t is FeedCard => t !== null)
  }
}
