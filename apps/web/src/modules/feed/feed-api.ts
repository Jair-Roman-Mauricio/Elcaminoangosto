import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'

export interface FeedCard {
  id: string
  authorName: string
  type: 'VIDEO' | 'IMAGE'
  caption: string | null
  /** Ficha del lienzo. Nula en tarjetas sin rellenar: el cliente la completa. */
  title: string | null
  manifesto: string | null
  /** Relato; los párrafos vienen separados por una línea en blanco. */
  story: string | null
  origin: string | null
  reference: string | null
  /** URL firmada del relato hablado, si lo tiene. */
  audioUrl: string | null
  mediaUrl: string
  posterUrl: string | null
  publishedAt: string | null
}

/** Feed vertical paginado por cursor (`publishedAt`). */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: ['feed'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiClient.get<FeedCard[]>(`/feed${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (ultima) =>
      ultima.length === 0 ? undefined : (ultima[ultima.length - 1]?.publishedAt ?? undefined),
    // Las URLs firmadas caducan (~60 min): refrescar al reenfocar.
    staleTime: 5 * 60 * 1000,
  })
}

export function usePublicarTarjeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { mediaAssetId: string; caption: string | null }) =>
      apiClient.post('/feed', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['feed'] }),
  })
}
