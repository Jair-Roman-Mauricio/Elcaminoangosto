import { apiClient } from '../../lib/api-client'

/**
 * Respaldo de los favoritos en el servidor.
 *
 * Quien guarda música no tiene cuenta: su colección se identifica con un código
 * que el servidor genera al crear el primer álbum. Ese código es lo único que
 * la devuelve en otro dispositivo, y por eso la interfaz debe insistir en que
 * se guarde: perderlo es perder la colección.
 */

export interface AlbumDeColeccion {
  albumId: string
  titulo: string
  coverUrl: string | null
  songIds: string[]
}

export interface ContenidoDeColeccion {
  coleccionId: string
  cancionesFavoritas: string[]
  albumesPersonales: AlbumDeColeccion[]
}

/** Crea el álbum. Sin código, abre la colección y devuelve el suyo. */
export function crearAlbumEnServidor(titulo: string, codigo: string | null) {
  return apiClient.post<{ album: AlbumDeColeccion; codigo: string | null }>(
    '/music/collections/albums',
    codigo ? { titulo, codigo } : { titulo },
  )
}

export function editarAlbumEnServidor(
  codigo: string,
  albumId: string,
  cambios: { titulo: string; coverUrl: string | null; songIds: string[] },
) {
  return apiClient.patch<AlbumDeColeccion>(`/music/collections/albums/${albumId}`, {
    codigo,
    ...cambios,
  })
}

export function marcarCancionEnServidor(codigo: string, songId: string, favorita: boolean) {
  return apiClient.post(`/music/collections/songs/${songId}`, { codigo, favorita })
}

export function abrirColeccion(codigo: string) {
  return apiClient.post<ContenidoDeColeccion>('/music/collections/open', { codigo })
}
