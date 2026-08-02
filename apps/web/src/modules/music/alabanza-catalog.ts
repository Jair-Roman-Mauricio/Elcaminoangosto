import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { PistaEnReproduccion } from '../../stores/player.store'

/*
 * Catálogo de Alabanza (HU-9.2). Hasta la construcción del contexto `music`
 * esto era una lista escrita aquí mismo; ahora los datos vienen del API y este
 * módulo se queda con los tipos, la consulta y las búsquedas.
 */

export type TonoDeAlabanza = 'vino' | 'marfil' | 'azul'

export interface AlbumDeAlabanza {
  albumId: string
  numero: string
  titulo: string
  descripcion: string
  coverUrl: string
  tono: TonoDeAlabanza
  discColor: string
}

export interface Alabanza extends PistaEnReproduccion {
  albumId: string
  numero: string
  subtitulo: string
  tono: TonoDeAlabanza
  fondo: { tipo: 'imagen' | 'video'; url: string } | null
  /** Contenido del `.srt`. Solo se pinta sobre fondos de imagen. */
  subtitulos?: string | null
}

export interface CatalogoDeAlabanza {
  albumes: AlbumDeAlabanza[]
  canciones: Alabanza[]
}

const CATALOGO_VACIO: CatalogoDeAlabanza = { albumes: [], canciones: [] }

/**
 * Álbumes y canciones publicadas. Las URL del audio van firmadas y caducan
 * (~60 min), así que la consulta se refresca sola pasado ese margen.
 */
export function useCatalogoDeAlabanza() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['alabanza'],
    queryFn: () => apiClient.get<CatalogoDeAlabanza>('/music/catalog'),
    staleTime: 30 * 60 * 1000,
  })
  return { catalogo: data ?? CATALOGO_VACIO, cargando: isPending, error: isError }
}

export function buscarAlbum(
  albumes: AlbumDeAlabanza[],
  albumId: string | null | undefined,
): AlbumDeAlabanza | undefined {
  return albumes.find((album) => album.albumId === albumId)
}

export function buscarCancion(
  canciones: Alabanza[],
  songId: string | null | undefined,
): Alabanza | undefined {
  return canciones.find((cancion) => cancion.songId === songId)
}

/** Ruta de la pantalla de Alabanza para una canción concreta. */
export function rutaDeReproduccion(
  songId: string,
  albumId?: string | null,
  collectionId?: string | null,
): string {
  if (!albumId) return '/alabanza'
  const parametros = new URLSearchParams({ album: albumId, song: songId })
  if (collectionId) {
    parametros.set('category', 'favorites')
    parametros.set('collection', collectionId)
  }
  return `/alabanza?${parametros.toString()}`
}
