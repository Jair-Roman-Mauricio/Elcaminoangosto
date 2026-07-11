export interface PostEntity {
  id: string
  authorId: string
  type: 'VIDEO' | 'IMAGE'
  mediaAssetId: string
  caption: string | null
  status: 'PUBLISHED' | 'HIDDEN' | 'REPORTED'
}

/** Fila del feed, ya unida al autor y al asset (solo READY). */
export interface FeedCardEntity {
  id: string
  authorId: string
  authorName: string
  type: 'VIDEO' | 'IMAGE'
  caption: string | null
  mediaAssetId: string
  bucket: string
  /** Ruta del MP4/imagen y del póster, para firmar en el servicio. */
  mediaPath: string
  posterPath: string | null
  publishedAt: Date | null
}

export abstract class PostRepository {
  abstract create(input: {
    authorId: string
    type: 'VIDEO' | 'IMAGE'
    mediaAssetId: string
    caption: string | null
  }): Promise<PostEntity>

  /**
   * Feed vertical: posts PUBLISHED cuyo medio está READY, más recientes primero.
   * Devuelve una página (cursor por `publishedAt`).
   */
  abstract findFeed(limit: number, before: Date | null): Promise<FeedCardEntity[]>

  abstract findById(id: string): Promise<PostEntity | null>
}
