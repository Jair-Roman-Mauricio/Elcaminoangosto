import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../lib/api-client'

/* Contratos de la analítica (espejo del servidor). */

export type TipoDeContenido = 'VIDEO' | 'POST' | 'SONG' | 'LECTURA' | 'ORACION'

export interface ContenidoMasVisto {
  contentId: string
  titulo: string
  /** Álbum de la canción o serie del video; nulo si no aplica. */
  contexto: string | null
  vistas: number
  /** Sesiones distintas: quien repite no cuenta diez veces. */
  visitantes: number
  ultimaVista: string | null
}

export interface AlbumMasEscuchado {
  albumId: string
  titulo: string
  numero: string | null
  escuchas: number
  canciones: number
}

/**
 * Quién entra. No se separa entre registrados y anónimos porque nadie tiene
 * cuenta salvo la administración, cuyo tráfico se descuenta de todo.
 */
export interface FlujoDeVisitantes {
  /** Sesiones distintas en el periodo. */
  visitantes: number
  /** Entradas a secciones. */
  visitas: number
  /** Piezas abiertas: videos, tarjetas y canciones juntos. */
  vistasDeContenido: number
  porDia: { dia: string; visitantes: number; visitas: number }[]
  porSeccion: { seccion: string; visitas: number; visitantes: number }[]
}

/** Cómo se ordena: por reproducciones o por sesiones distintas. */
export type OrdenDeRanking = 'vistas' | 'visitantes'

/** Lo más visto de un tipo. La búsqueda y el orden los resuelve el servidor. */
export function useMasVistos(
  kind: TipoDeContenido,
  dias: number,
  busqueda = '',
  orden: OrdenDeRanking = 'vistas',
) {
  const query = new URLSearchParams({ kind, dias: String(dias), orden })
  if (busqueda.trim()) query.set('busqueda', busqueda.trim())

  return useQuery({
    queryKey: ['analitica', 'mas-vistos', kind, dias, busqueda.trim(), orden],
    queryFn: () => apiClient.get<ContenidoMasVisto[]>(`/analytics/most-viewed?${query}`),
    // Un ranking no cambia de un segundo a otro; evita repetir al cambiar de pestaña.
    staleTime: 60 * 1000,
  })
}

export function useAlbumesMasEscuchados(dias: number, busqueda = '') {
  const query = new URLSearchParams({ dias: String(dias) })
  if (busqueda.trim()) query.set('busqueda', busqueda.trim())

  return useQuery({
    queryKey: ['analitica', 'albumes', dias, busqueda.trim()],
    queryFn: () => apiClient.get<AlbumMasEscuchado[]>(`/analytics/top-albums?${query}`),
    staleTime: 60 * 1000,
  })
}

export function useFlujoDeVisitantes(dias: number) {
  return useQuery({
    queryKey: ['analitica', 'visitantes', dias],
    queryFn: () => apiClient.get<FlujoDeVisitantes>(`/analytics/visitors?dias=${dias}`),
    staleTime: 60 * 1000,
  })
}
