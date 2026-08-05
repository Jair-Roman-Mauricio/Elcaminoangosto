import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/** Un comentario de video (espejo del servidor). */
export interface ComentarioDeVideo {
  id: string
  /** Alias dentro de este video: «Caminante 2». Nunca un nombre real. */
  autor: string
  mensaje: string
  createdAt: string
  oculto: boolean
}

/**
 * Identificador de quien comenta.
 *
 * El mismo que usa la comunidad, y por la misma razón: aleatorio, guardado en
 * este navegador y sin significado. Permite que sus mensajes lleven el mismo
 * alias dentro de un video y que el servidor pueda frenar a quien publique sin
 * parar. Quien borre los datos del navegador aparecerá como alguien nuevo.
 */
const CLAVE_AUTOR = 'elcamino:comunidad:autor'

function idDeAutor(): string {
  try {
    const guardado = window.localStorage.getItem(CLAVE_AUTOR)
    if (guardado) return guardado
    const nuevo = crypto.randomUUID().replace(/-/g, '')
    window.localStorage.setItem(CLAVE_AUTOR, nuevo)
    return nuevo
  } catch {
    return crypto.randomUUID().replace(/-/g, '')
  }
}

export function useComentariosDeVideo(videoId: string | null) {
  return useQuery({
    queryKey: ['videos', 'comentarios', videoId],
    queryFn: () => apiClient.get<ComentarioDeVideo[]>(`/videos/${videoId}/comments`),
    enabled: Boolean(videoId),
  })
}

/** Comentar no pide cuenta: no hay cuentas. */
export function useComentarVideo(videoId: string | null) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (cuerpo: string) =>
      apiClient.post<ComentarioDeVideo>(`/videos/${videoId}/comments`, {
        cuerpo,
        autorId: idDeAutor(),
      }),
    onSuccess: () =>
      cliente.invalidateQueries({ queryKey: ['videos', 'comentarios', videoId] }),
  })
}
