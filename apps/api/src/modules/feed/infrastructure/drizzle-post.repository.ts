import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, lt, sql } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { posts, profiles, mediaAssets } from '../../shared/database/schema'
import {
  PostRepository,
  type PostEntity,
  type FeedCardEntity,
} from '../domain/post.repository'

@Injectable()
export class DrizzlePostRepository extends PostRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async create(input: {
    authorId: string
    type: 'VIDEO' | 'IMAGE'
    mediaAssetId: string
    caption: string | null
  }): Promise<PostEntity> {
    // Publicación directa (Q-2): nace PUBLISHED con fecha. El feed solo lo
    // muestra cuando el medio esté READY.
    const [fila] = await this.db
      .insert(posts)
      .values({ ...input, status: 'PUBLISHED', publishedAt: new Date() })
      .returning()
    if (!fila) throw new NotFoundException('No se pudo crear la tarjeta')
    return this.mapear(fila)
  }

  async findFeed(limit: number, before: Date | null): Promise<FeedCardEntity[]> {
    const filas = await this.db
      .select({
        id: posts.id,
        authorId: posts.authorId,
        authorName: profiles.displayName,
        type: posts.type,
        caption: posts.caption,
        mediaAssetId: posts.mediaAssetId,
        bucket: mediaAssets.bucket,
        mediaPath: mediaAssets.path,
        posterPath: mediaAssets.posterPath,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .innerJoin(profiles, eq(posts.authorId, profiles.id))
      .innerJoin(mediaAssets, eq(posts.mediaAssetId, mediaAssets.id))
      .where(
        and(
          eq(posts.status, 'PUBLISHED'),
          eq(mediaAssets.status, 'READY'),
          sql`${posts.publishedAt} is not null`,
          before ? lt(posts.publishedAt, before) : undefined,
        ),
      )
      .orderBy(desc(posts.publishedAt))
      .limit(limit)

    return filas
  }

  async findById(id: string): Promise<PostEntity | null> {
    const filas = await this.db.select().from(posts).where(eq(posts.id, id)).limit(1)
    return filas[0] ? this.mapear(filas[0]) : null
  }

  private mapear(f: typeof posts.$inferSelect): PostEntity {
    return {
      id: f.id,
      authorId: f.authorId,
      type: f.type,
      mediaAssetId: f.mediaAssetId,
      caption: f.caption,
      status: f.status,
    }
  }
}
