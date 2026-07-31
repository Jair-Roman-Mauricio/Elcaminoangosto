import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { VideoRepository, type VideoEntity, type VideoStatus } from '../domain/video.repository'
import { MediaService } from '../../media'
import type { Actor } from '../../shared'

/** Video del catálogo, con las URLs ya firmadas para el cliente. */
export interface VideoCard {
  id: string
  title: string
  series: string | null
  description: string | null
  reference: string | null
  authorName: string
  /** URL firmada del video. */
  mediaUrl: string
  /** URL firmada del póster (primer fotograma). */
  posterUrl: string | null
  publishedAt: string | null
}

/** Video como lo ve el admin: incluye ocultos y los que aún se procesan. */
export interface AdminVideo {
  id: string
  title: string
  series: string | null
  description: string | null
  reference: string | null
  authorName: string
  status: VideoStatus
  /** Explica por qué un video publicado todavía no aparece en el catálogo. */
  mediaStatus: string
  posterUrl: string | null
  publishedAt: string | null
  createdAt: string
}

/**
 * API pública del bounded context `videos` (HU-9.3).
 *
 * Mismo trato que las Tarjetas de Fe: el archivo vive en `media`, el catálogo
 * solo muestra lo publicado con el medio READY, y publicar o retirar es cosa
 * del admin.
 */
@Injectable()
export class VideosService {
  constructor(
    private readonly videos: VideoRepository,
    private readonly media: MediaService,
  ) {}

  /** Catálogo para cualquier usuario autenticado. */
  async catalogo(): Promise<VideoCard[]> {
    const filas = await this.videos.findPublished()
    return Promise.all(
      filas.map(async (v) => ({
        id: v.id,
        title: v.title,
        series: v.series,
        description: v.description,
        reference: v.reference,
        authorName: v.authorName,
        mediaUrl: await this.media.urlDeLectura(v.mediaAssetId, true),
        posterUrl: await this.media.urlDePoster(v.mediaAssetId, true),
        publishedAt: v.publishedAt?.toISOString() ?? null,
      })),
    )
  }

  // ── Administración de contenido (solo ADMIN) ──────────────────────────────

  async listarParaAdmin(actor: Actor): Promise<AdminVideo[]> {
    this.exigirAdmin(actor)
    const filas = await this.videos.findAll()
    return Promise.all(
      filas.map(async (v) => ({
        id: v.id,
        title: v.title,
        series: v.series,
        description: v.description,
        reference: v.reference,
        authorName: v.authorName,
        status: v.status,
        mediaStatus: v.mediaStatus,
        // Sin procesar todavía no hay póster: la tarjeta se muestra sin él.
        posterUrl: await this.media.urlDePoster(v.mediaAssetId, true).catch(() => null),
        publishedAt: v.publishedAt?.toISOString() ?? null,
        createdAt: v.createdAt.toISOString(),
      })),
    )
  }

  /** Publica un video ya subido. El medio debe ser un video del propio admin. */
  async publicar(
    actor: Actor,
    input: {
      title: string
      series: string | null
      description: string | null
      reference: string | null
      mediaAssetId: string
    },
  ): Promise<VideoEntity> {
    this.exigirAdmin(actor)

    const asset = await this.media.estado(input.mediaAssetId)
    if (asset.kind !== 'VIDEO') {
      throw new BadRequestException('El contenido de esta sección debe ser un video')
    }
    if (asset.ownerId !== actor.id) {
      throw new ForbiddenException('Ese medio no es tuyo')
    }

    return this.videos.create({ ...input, createdBy: actor.id })
  }

  /** Corrige la ficha (título, serie, descripción, cita) sin tocar el archivo. */
  async editar(
    actor: Actor,
    videoId: string,
    cambios: {
      title?: string | undefined
      series?: string | null | undefined
      description?: string | null | undefined
      reference?: string | null | undefined
    },
  ): Promise<VideoEntity> {
    this.exigirAdmin(actor)
    await this.existente(videoId)
    return this.videos.update(videoId, cambios)
  }

  async cambiarEstado(actor: Actor, videoId: string, status: VideoStatus): Promise<VideoEntity> {
    this.exigirAdmin(actor)
    const video = await this.existente(videoId)
    if (video.status === status) {
      throw new BadRequestException('El video ya está en ese estado')
    }
    return this.videos.updateStatus(videoId, status)
  }

  /** Elimina el video y su archivo: primero la fila, que referencia el asset. */
  async eliminar(actor: Actor, videoId: string): Promise<void> {
    this.exigirAdmin(actor)
    const video = await this.existente(videoId)

    await this.videos.remove(videoId)
    await this.media.eliminar(video.mediaAssetId)
  }

  private async existente(videoId: string): Promise<VideoEntity> {
    const video = await this.videos.findById(videoId)
    if (!video) throw new NotFoundException('Video no encontrado')
    return video
  }

  private exigirAdmin(actor: Actor): void {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un admin administra los videos')
    }
  }
}
