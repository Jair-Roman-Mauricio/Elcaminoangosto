import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, type SQL } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { mediaAssets, profiles, videos } from '../../shared/database/schema'
import {
  VideoRepository,
  type VideoConMedioEntity,
  type VideoEntity,
  type VideoStatus,
} from '../domain/video.repository'

@Injectable()
export class DrizzleVideoRepository extends VideoRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async findPublished(): Promise<VideoConMedioEntity[]> {
    return this.consultaConMedio(
      and(eq(videos.status, 'PUBLISHED'), eq(mediaAssets.status, 'READY')),
    )
  }

  async findAll(): Promise<VideoConMedioEntity[]> {
    return this.consultaConMedio(undefined)
  }

  async findById(id: string): Promise<VideoEntity | null> {
    const filas = await this.db.select().from(videos).where(eq(videos.id, id)).limit(1)
    return filas[0] ? this.mapear(filas[0]) : null
  }

  async create(input: {
    title: string
    series: string | null
    description: string | null
    reference: string | null
    mediaAssetId: string
    createdBy: string
  }): Promise<VideoEntity> {
    // Nace publicado con fecha; el catálogo lo muestra cuando el medio esté READY.
    const [fila] = await this.db
      .insert(videos)
      .values({ ...input, status: 'PUBLISHED', publishedAt: new Date() })
      .returning()
    if (!fila) throw new NotFoundException('No se pudo crear el video')
    return this.mapear(fila)
  }

  async update(
    id: string,
    cambios: {
      title?: string | undefined
      series?: string | null | undefined
      description?: string | null | undefined
      reference?: string | null | undefined
    },
  ): Promise<VideoEntity> {
    const [fila] = await this.db.update(videos).set(cambios).where(eq(videos.id, id)).returning()
    if (!fila) throw new NotFoundException('Video no encontrado')
    return this.mapear(fila)
  }

  async updateStatus(id: string, status: VideoStatus): Promise<VideoEntity> {
    const [fila] = await this.db
      .update(videos)
      .set(status === 'PUBLISHED' ? { status, publishedAt: new Date() } : { status })
      .where(eq(videos.id, id))
      .returning()
    if (!fila) throw new NotFoundException('Video no encontrado')
    return this.mapear(fila)
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(videos).where(eq(videos.id, id))
  }

  /** Listado unido al medio y al autor; el `where` decide qué se incluye. */
  private async consultaConMedio(filtro: SQL | undefined): Promise<VideoConMedioEntity[]> {
    const consulta = this.db
      .select({
        id: videos.id,
        title: videos.title,
        series: videos.series,
        description: videos.description,
        reference: videos.reference,
        mediaAssetId: videos.mediaAssetId,
        status: videos.status,
        createdBy: videos.createdBy,
        publishedAt: videos.publishedAt,
        createdAt: videos.createdAt,
        mediaStatus: mediaAssets.status,
        authorName: profiles.displayName,
      })
      .from(videos)
      .innerJoin(mediaAssets, eq(videos.mediaAssetId, mediaAssets.id))
      .innerJoin(profiles, eq(videos.createdBy, profiles.id))
      .orderBy(desc(videos.createdAt))

    return filtro ? consulta.where(filtro) : consulta
  }

  private mapear(f: typeof videos.$inferSelect): VideoEntity {
    return {
      id: f.id,
      title: f.title,
      series: f.series,
      description: f.description,
      reference: f.reference,
      mediaAssetId: f.mediaAssetId,
      status: f.status,
      createdBy: f.createdBy,
      publishedAt: f.publishedAt,
      createdAt: f.createdAt,
    }
  }
}
