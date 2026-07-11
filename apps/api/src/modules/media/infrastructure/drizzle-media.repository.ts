import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { Bucket, MediaKind, MediaStatus } from '@elcamino/shared-types'
import { DRIZZLE, type Database } from '../../shared'
import { mediaAssets } from '../../shared/database/schema'
import { MediaRepository, type MediaAssetEntity } from '../domain/media.repository'

@Injectable()
export class DrizzleMediaRepository extends MediaRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async create(input: {
    ownerId: string
    bucket: Bucket
    path: string
    kind: MediaKind
  }): Promise<MediaAssetEntity> {
    const [fila] = await this.db
      .insert(mediaAssets)
      .values({ ...input, status: 'UPLOADED' })
      .returning()
    if (!fila) throw new NotFoundException('No se pudo crear el asset')
    return this.mapear(fila)
  }

  async findById(id: string): Promise<MediaAssetEntity | null> {
    const filas = await this.db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1)
    return filas[0] ? this.mapear(filas[0]) : null
  }

  async setStatus(id: string, status: MediaStatus): Promise<void> {
    await this.db
      .update(mediaAssets)
      .set({ status, updatedAt: new Date() })
      .where(eq(mediaAssets.id, id))
  }

  private mapear(f: typeof mediaAssets.$inferSelect): MediaAssetEntity {
    return {
      id: f.id,
      ownerId: f.ownerId,
      bucket: f.bucket as Bucket,
      path: f.path,
      kind: f.kind,
      status: f.status,
      hlsPath: f.hlsPath,
      posterPath: f.posterPath,
      durationSeconds: f.durationSeconds,
      bytes: f.bytes,
    }
  }
}
