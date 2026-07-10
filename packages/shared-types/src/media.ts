import { z } from 'zod'

export const MediaKindSchema = z.enum(['AUDIO', 'VIDEO', 'IMAGE'])
export type MediaKind = z.infer<typeof MediaKindSchema>

export const MediaStatusSchema = z.enum(['UPLOADED', 'PROCESSING', 'READY', 'FAILED'])
export type MediaStatus = z.infer<typeof MediaStatusSchema>

/** Buckets de Supabase Storage (arquitectura.md §3.4). */
export const BucketSchema = z.enum([
  'avatars', // público
  'thumbnails', // público
  'music', // privado
  'feed-media', // privado
  'course-media', // privado
])
export type Bucket = z.infer<typeof BucketSchema>

export const PUBLIC_BUCKETS: readonly Bucket[] = ['avatars', 'thumbnails']

export function isPrivateBucket(bucket: Bucket): boolean {
  return !PUBLIC_BUCKETS.includes(bucket)
}

/** Vida de una URL firmada para medio privado (arquitectura.md §6). */
export const SIGNED_URL_TTL_SECONDS = 60 * 60 // 60 min

export const MediaAssetSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  bucket: BucketSchema,
  path: z.string(),
  kind: MediaKindSchema,
  status: MediaStatusSchema,
  hlsPath: z.string().nullable(),
  posterPath: z.string().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
})
export type MediaAsset = z.infer<typeof MediaAssetSchema>
