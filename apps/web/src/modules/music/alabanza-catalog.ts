import type { PistaEnReproduccion } from '../../stores/player.store'

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
  fondo: { tipo: 'imagen' | 'video'; url: string }
  /** Solo se usa con fondos de imagen. Los videos no muestran subtítulos. */
  subtitlesUrl?: string
}

export const ALBUMES_DE_ALABANZA: AlbumDeAlabanza[] = [
  { albumId: 'gracia', numero: 'A01', titulo: 'Himnos de gracia', descripcion: 'Cantos para volver al origen de la fe.', coverUrl: '/music/covers/himnos-de-gracia.webp', tono: 'vino', discColor: '#111114' },
  { albumId: 'madero', numero: 'A02', titulo: 'Madero de esperanza', descripcion: 'Meditaciones para caminar con quietud.', coverUrl: '/music/covers/madero-de-esperanza.webp', tono: 'marfil', discColor: '#8f6f45' },
  { albumId: 'caminar', numero: 'A03', titulo: 'Alma en camino', descripcion: 'Alabanzas para celebrar el recorrido.', coverUrl: '/music/covers/alma-en-camino.webp', tono: 'azul', discColor: '#173f65' },
]

export const CANCIONES_DE_ALABANZA: Alabanza[] = [
  {
    songId: 'gracia-que-me-encontro',
    albumId: 'gracia',
    numero: '01',
    titulo: 'Gracia que me encontró',
    subtitulo: 'Himnos para volver al centro',
    artista: 'Opus33',
    audioUrl: '/music/amazing-grace.ogg',
    coverUrl: '/music/covers/himnos-de-gracia.webp',
    durationSeconds: 31,
    tono: 'vino',
    fondo: { tipo: 'imagen', url: '/posters/1.jpg' },
    subtitlesUrl: '/music/subtitles/gracia-que-me-encontro.srt',
  },
  {
    songId: 'madero-de-esperanza',
    albumId: 'madero',
    numero: '02',
    titulo: 'Madero de esperanza',
    subtitulo: 'Cantos para la contemplación',
    artista: 'Membeth',
    audioUrl: '/music/ecce-lignum-crucis.ogg',
    coverUrl: '/music/covers/madero-de-esperanza.webp',
    durationSeconds: 53,
    tono: 'marfil',
    fondo: { tipo: 'video', url: '/media/2-vertical.mp4' },
  },
  {
    songId: 'alaba-alma-mia',
    albumId: 'caminar',
    numero: '03',
    titulo: 'Alaba, alma mía',
    subtitulo: 'Una celebración para caminar',
    artista: 'St. Paul’s Episcopal Church',
    audioUrl: '/music/praise-my-soul.ogg',
    coverUrl: '/music/covers/alma-en-camino.webp',
    durationSeconds: 150,
    tono: 'azul',
    fondo: { tipo: 'imagen', url: '/posters/3.jpg' },
    subtitlesUrl: '/music/subtitles/alaba-alma-mia.srt',
  },
]

export function buscarAlbumDeAlabanza(albumId: string | null | undefined) {
  return ALBUMES_DE_ALABANZA.find((album) => album.albumId === albumId)
}

export function buscarCancionDeAlabanza(songId: string | null | undefined) {
  return CANCIONES_DE_ALABANZA.find((cancion) => cancion.songId === songId)
}

export function rutaDeReproduccion(songId: string, albumId?: string, collectionId?: string) {
  const cancion = buscarCancionDeAlabanza(songId)
  const album = albumId ?? cancion?.albumId
  if (!album) return '/alabanza'
  const parametros = new URLSearchParams({ album, song: songId })
  if (collectionId) {
    parametros.set('category', 'favorites')
    parametros.set('collection', collectionId)
  }
  return `/alabanza?${parametros.toString()}`
}
