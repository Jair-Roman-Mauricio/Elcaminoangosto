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
}
