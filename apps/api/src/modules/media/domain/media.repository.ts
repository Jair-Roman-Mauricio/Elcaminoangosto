import type { Bucket, MediaKind, MediaStatus } from '@elcamino/shared-types'

export interface MediaAssetEntity {
  id: string
  ownerId: string
  bucket: Bucket
  path: string
  kind: MediaKind
  status: MediaStatus
  hlsPath: string | null
  posterPath: string | null
  durationSeconds: number | null
  bytes: number | null
}

export abstract class MediaRepository {
  abstract create(input: {
    ownerId: string
    bucket: Bucket
    path: string
    kind: MediaKind
  }): Promise<MediaAssetEntity>

  abstract findById(id: string): Promise<MediaAssetEntity | null>

  abstract setStatus(id: string, status: MediaStatus): Promise<void>

  /**
   * Marca el asset como READY con sus derivados. Lo usa el API para las
   * imágenes, que no pasan por la cola porque no hay nada que transcodificar.
   */
  abstract markReady(
    id: string,
    derivados: { posterPath: string | null; durationSeconds: number | null },
  ): Promise<void>

  abstract delete(id: string): Promise<void>
}
