/**
 * Ficha de la tarjeta: lo que se lee en el lienzo del feed. Todo opcional; una
 * tarjeta anterior solo tenía `caption` y el cliente completaba el resto.
 */
export interface PostFicha {
  title: string | null
  /** Frase destacada. */
  manifesto: string | null
  /** Relato; los párrafos se separan con una línea en blanco. */
  story: string | null
  origin: string | null
  /** Referencia bíblica. */
  reference: string | null
  /** Relato hablado, opcional. */
  audioAssetId: string | null
}

export interface PostEntity extends PostFicha {
  id: string
  authorId: string
  type: 'VIDEO' | 'IMAGE'
  mediaAssetId: string
  caption: string | null
  status: 'PUBLISHED' | 'HIDDEN' | 'REPORTED'
}

/** Fila del feed, ya unida al autor y al asset (solo READY). */
export interface FeedCardEntity extends PostFicha {
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

export type PostStatus = PostEntity['status']

/**
 * Tarjeta tal como la ve el administrador: incluye las ocultas y las que
 * todavía no tienen el medio listo, con el estado del asset para explicar por
 * qué una tarjeta no se ve en el feed.
 */
export interface AdminPostEntity extends PostFicha {
  id: string
  authorId: string
  authorName: string
  type: 'VIDEO' | 'IMAGE'
  caption: string | null
  status: PostStatus
  mediaAssetId: string
  /** Estado del medio: UPLOADED, PROCESSING, READY, FAILED. */
  mediaStatus: string
  publishedAt: Date | null
  createdAt: Date
}

export abstract class PostRepository {
  abstract create(
    input: {
      authorId: string
      type: 'VIDEO' | 'IMAGE'
      mediaAssetId: string
      caption: string | null
    } & Partial<PostFicha>,
  ): Promise<PostEntity>

  /**
   * Feed vertical: posts PUBLISHED cuyo medio está READY, más recientes primero.
   * Devuelve una página (cursor por `publishedAt`).
   */
  abstract findFeed(limit: number, before: Date | null): Promise<FeedCardEntity[]>

  abstract findById(id: string): Promise<PostEntity | null>

  // ── Administración de contenido (solo ADMIN) ──────────────────────────────

  /** Todas las tarjetas, en cualquier estado, más recientes primero. */
  abstract findAllForAdmin(): Promise<AdminPostEntity[]>

  /** Publica u oculta una tarjeta. Al publicar se fija `publishedAt`. */
  abstract updateStatus(id: string, status: PostStatus): Promise<PostEntity>

  /** Cambia la ficha del lienzo. El medio y el autor no se tocan aquí. */
  abstract updateFicha(
    id: string,
    cambios: { [K in keyof PostFicha | 'caption']?: string | null | undefined },
  ): Promise<PostEntity>

  /** Borra la tarjeta. El medio lo elimina el servicio, después. */
  abstract remove(id: string): Promise<void>
}
