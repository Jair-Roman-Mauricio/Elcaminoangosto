import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'

/* Contratos de la comunidad (espejo del servidor). */

export interface HiloResumen {
  id: string
  titulo: string
  respuestas: number
  ultimaActividad: string
  createdAt: string
}

export interface Respuesta {
  id: string
  /** Respuesta a la que contesta; `null` si contesta al hilo. */
  respuestaPadreId: string | null
  cuerpo: string
  autor: string
  createdAt: string
  oculto: boolean
}

export interface HiloDetalle {
  id: string
  titulo: string
  cuerpo: string
  autor: string
  createdAt: string
  oculto: boolean
  respuestas: Respuesta[]
}

const CLAVE_AUTOR = 'elcamino:comunidad:autor'

/**
 * Identificador de quien escribe.
 *
 * Aleatorio y guardado en este navegador. No dice quién es nadie: solo permite
 * que sus mensajes lleven el mismo alias dentro de un hilo y que el servidor
 * pueda frenar a quien publique sin parar. Quien borre los datos del navegador
 * aparecerá como alguien nuevo, y está bien que así sea.
 */
export function idDeAutor(): string {
  try {
    const guardado = window.localStorage.getItem(CLAVE_AUTOR)
    if (guardado) return guardado
    const nuevo = crypto.randomUUID().replace(/-/g, '')
    window.localStorage.setItem(CLAVE_AUTOR, nuevo)
    return nuevo
  } catch {
    // Sin almacenamiento cada visita es alguien nuevo; se puede escribir igual.
    return crypto.randomUUID().replace(/-/g, '')
  }
}

export function useHilos(busqueda: string) {
  const termino = busqueda.trim()
  return useQuery({
    queryKey: ['comunidad', 'hilos', termino],
    queryFn: () => {
      const query = new URLSearchParams()
      if (termino) query.set('busqueda', termino)
      return apiClient.get<HiloResumen[]>(`/community/threads?${query}`)
    },
  })
}

export function useHilo(id: string) {
  return useQuery({
    queryKey: ['comunidad', 'hilo', id],
    queryFn: () => apiClient.get<HiloDetalle>(`/community/threads/${id}`),
    enabled: Boolean(id),
  })
}

export function useAbrirHilo() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (input: { titulo: string; cuerpo: string }) =>
      apiClient.post<{ id: string }>('/community/threads', { ...input, autorId: idDeAutor() }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['comunidad', 'hilos'] }),
  })
}

/**
 * Responder al hilo, o a una de sus respuestas si se pasa `respuestaPadreId`.
 * La conversación admite un solo nivel; el servidor rechaza contestar a una
 * contestación.
 */
export function useResponder(hiloId: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({
      cuerpo,
      respuestaPadreId,
    }: {
      cuerpo: string
      respuestaPadreId?: string
    }) =>
      apiClient.post<{ id: string }>(`/community/threads/${hiloId}/replies`, {
        cuerpo,
        autorId: idDeAutor(),
        ...(respuestaPadreId ? { respuestaPadreId } : {}),
      }),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['comunidad', 'hilo', hiloId] })
      void cliente.invalidateQueries({ queryKey: ['comunidad', 'hilos'] })
    },
  })
}

export function useOcultarHilo() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, oculto }: { id: string; oculto: boolean }) =>
      apiClient.patch(`/community/threads/${id}/hidden`, { oculto }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['comunidad'] }),
  })
}

export function useOcultarRespuesta(hiloId: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, oculto }: { id: string; oculto: boolean }) =>
      apiClient.patch(`/community/replies/${id}/hidden`, { oculto }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['comunidad', 'hilo', hiloId] }),
  })
}
