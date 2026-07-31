import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'

/** Video del catálogo, con las URLs ya firmadas (espejo del servidor). */
export interface VideoCatalogo {
  id: string
  title: string
  series: string | null
  description: string | null
  reference: string | null
  authorName: string
  mediaUrl: string
  posterUrl: string | null
  publishedAt: string | null
}

/**
 * Catálogo de videos cristianos (HU-9.3). Las URLs van firmadas y caducan,
 * así que la consulta se refresca con el tiempo.
 */
export function useVideos() {
  return useQuery({
    queryKey: ['videos'],
    queryFn: () => apiClient.get<VideoCatalogo[]>('/videos'),
    staleTime: 5 * 60 * 1000,
  })
}
