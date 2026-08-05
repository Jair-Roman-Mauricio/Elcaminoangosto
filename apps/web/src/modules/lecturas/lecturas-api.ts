import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'

/* Contratos de las lecturas (espejo del servidor). */

export type TipoDeLectura = 'DEVOCIONAL' | 'ARTICULO'

export interface Lectura {
  id: string
  tipo: TipoDeLectura
  titulo: string
  entradilla: string | null
  /** Cuerpo en Markdown: párrafos, subtítulos e imágenes. */
  cuerpo: string
  /** Sección dentro de la revista. Nula en un devocional. */
  seccion: string | null
  autor: string
  referencia: string | null
  portadaUrl: string | null
  /** Minutos de lectura, calculados del propio texto por el servidor. */
  minutos: number
  publishedAt: string | null
  oculto: boolean
}

export interface ComentarioDeLectura {
  id: string
  /** Alias dentro del artículo: «Caminante 2». Nunca un nombre real. */
  autor: string
  mensaje: string
  createdAt: string
  oculto: boolean
}

export interface OracionGuiada {
  id: string
  titulo: string
  tema: string | null
  lineas: string[]
  /** Segundo en que empieza cada línea; si falta, se reparten por longitud. */
  marcas: number[] | null
  audioUrl: string
  publishedAt: string | null
  oculto: boolean
}

/** El mismo identificador anónimo que usan la comunidad y los videos. */
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

export function useDevocionales() {
  return useQuery({
    queryKey: ['lecturas', 'devocionales'],
    queryFn: () => apiClient.get<Lectura[]>('/devocionales'),
    staleTime: 60 * 1000,
  })
}

export function useRevista() {
  return useQuery({
    queryKey: ['lecturas', 'revista'],
    queryFn: () => apiClient.get<Lectura[]>('/revista'),
    staleTime: 60 * 1000,
  })
}

/**
 * Una lectura sola, por su identificador.
 *
 * Existe para que un artículo de revista se pueda abrir desde su propio enlace:
 * quien recarga la página o comparte el enlace con alguien tiene que caer en el
 * artículo, no en el índice.
 */
export function useLectura(id: string | null) {
  return useQuery({
    queryKey: ['lecturas', 'una', id],
    queryFn: () => apiClient.get<Lectura>(`/lecturas/${id}`),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  })
}

/** Tres lecturas para seguir después de esta, de la misma sección. */
export function useRelacionadas(id: string | null) {
  return useQuery({
    queryKey: ['lecturas', 'relacionadas', id],
    queryFn: () => apiClient.get<Lectura[]>(`/lecturas/${id}/relacionadas`),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  })
}

export function useOraciones() {
  return useQuery({
    queryKey: ['lecturas', 'oraciones'],
    queryFn: () => apiClient.get<OracionGuiada[]>('/oraciones'),
    staleTime: 60 * 1000,
  })
}

export function useComentariosDeLectura(lecturaId: string | null) {
  return useQuery({
    queryKey: ['lecturas', 'comentarios', lecturaId],
    queryFn: () => apiClient.get<ComentarioDeLectura[]>(`/lecturas/${lecturaId}/comments`),
    enabled: Boolean(lecturaId),
  })
}

/** Comentar un artículo. No pide cuenta: no hay cuentas. */
export function useComentarLectura(lecturaId: string | null) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (cuerpo: string) =>
      apiClient.post<ComentarioDeLectura>(`/lecturas/${lecturaId}/comments`, {
        cuerpo,
        autorId: idDeAutor(),
      }),
    onSuccess: () =>
      cliente.invalidateQueries({ queryKey: ['lecturas', 'comentarios', lecturaId] }),
  })
}
