/** Entidades de dominio. TypeScript puro: sin Nest, sin Drizzle. */

export type VideoStatus = 'PUBLISHED' | 'HIDDEN'

export interface VideoEntity {
  id: string
  title: string
  /** Serie o colección a la que pertenece. */
  series: string | null
  description: string | null
  /** Referencia bíblica, si la tiene. */
  reference: string | null
  mediaAssetId: string
  status: VideoStatus
  createdBy: string
  publishedAt: Date | null
  createdAt: Date
}

/** Video del catálogo, ya unido a su medio para poder firmar las URLs. */
export interface VideoConMedioEntity extends VideoEntity {
  /** Estado del medio: un video publicado no se ve hasta que esté READY. */
  mediaStatus: string
  authorName: string
}

export abstract class VideoRepository {
  /** Catálogo público: publicados con el medio listo, más recientes primero. */
  abstract findPublished(): Promise<VideoConMedioEntity[]>

  /** Todos, en cualquier estado, para el módulo Contenido (ADMIN). */
  abstract findAll(): Promise<VideoConMedioEntity[]>

  abstract findById(id: string): Promise<VideoEntity | null>

  abstract create(input: {
    title: string
    series: string | null
    description: string | null
    reference: string | null
    mediaAssetId: string
    createdBy: string
  }): Promise<VideoEntity>

  /** Edita los textos de la ficha. El medio no se cambia: se sube otro video. */
  abstract update(
    id: string,
    cambios: {
      title?: string | undefined
      series?: string | null | undefined
      description?: string | null | undefined
      reference?: string | null | undefined
    },
  ): Promise<VideoEntity>

  /** Publica u oculta. Al publicar se sella `publishedAt` si no lo tenía. */
  abstract updateStatus(id: string, status: VideoStatus): Promise<VideoEntity>

  abstract remove(id: string): Promise<void>
}
