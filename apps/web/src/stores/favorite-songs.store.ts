import { create } from 'zustand'

const CLAVE_FAVORITOS = 'elcamino:alabanzas:favoritos'
const CLAVE_ALBUMES = 'elcamino:alabanzas:albumes-favoritos'

export interface AlbumFavoritoDelUsuario {
  albumId: string
  titulo: string
  coverUrl: string | null
  songIds: string[]
  creadoEn: number
}

export interface CambiosDeAlbumFavorito {
  titulo: string
  coverUrl: string | null
  songIds: string[]
}

interface EstadoDeFavoritos {
  cancionesFavoritas: string[]
  albumesFavoritos: AlbumFavoritoDelUsuario[]
  hidratado: boolean
  hidratarFavoritos: () => void
  crearAlbumFavorito: (titulo: string) => string | null
  editarAlbumFavorito: (albumId: string, cambios: CambiosDeAlbumFavorito) => boolean
  actualizarDestinos: (songId: string, guardarEnFavoritos: boolean, albumIds: string[]) => void
}

function guardarFavoritos(ids: string[]) {
  try {
    window.localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(ids))
  } catch {
    // El almacenamiento es una mejora progresiva; la sesión sigue funcionando.
  }
}

function guardarAlbumes(albumes: AlbumFavoritoDelUsuario[]) {
  try {
    window.localStorage.setItem(CLAVE_ALBUMES, JSON.stringify(albumes))
  } catch {
    // El almacenamiento es una mejora progresiva; la sesión sigue funcionando.
  }
}

function normalizarAlbumFavorito(valor: unknown): AlbumFavoritoDelUsuario | null {
  if (!valor || typeof valor !== 'object') return null
  const album = valor as Partial<AlbumFavoritoDelUsuario>
  const esValido = typeof album.albumId === 'string'
    && typeof album.titulo === 'string'
    && Array.isArray(album.songIds)
    && album.songIds.every((songId) => typeof songId === 'string')
    && typeof album.creadoEn === 'number'
  if (!esValido) return null
  return {
    albumId: album.albumId!,
    titulo: album.titulo!,
    coverUrl: typeof album.coverUrl === 'string' ? album.coverUrl : null,
    songIds: Array.from(new Set(album.songIds!)),
    creadoEn: album.creadoEn!,
  }
}

export const useFavoriteSongsStore = create<EstadoDeFavoritos>((set, get) => ({
  cancionesFavoritas: [],
  albumesFavoritos: [],
  hidratado: false,

  hidratarFavoritos: () => {
    if (get().hidratado) return
    try {
      const guardado: unknown = JSON.parse(window.localStorage.getItem(CLAVE_FAVORITOS) ?? '[]')
      const cancionesFavoritas = Array.isArray(guardado)
        ? guardado.filter((item): item is string => typeof item === 'string')
        : []
      const albumesGuardados: unknown = JSON.parse(window.localStorage.getItem(CLAVE_ALBUMES) ?? '[]')
      const albumesFavoritos = Array.isArray(albumesGuardados)
        ? albumesGuardados
          .map(normalizarAlbumFavorito)
          .filter((album): album is AlbumFavoritoDelUsuario => album !== null)
        : []
      set({ cancionesFavoritas, albumesFavoritos, hidratado: true })
    } catch {
      set({ hidratado: true })
    }
  },

  crearAlbumFavorito: (titulo) => {
    const nombre = titulo.trim()
    if (!nombre) return null
    const existente = get().albumesFavoritos.find((album) => album.titulo.toLocaleLowerCase() === nombre.toLocaleLowerCase())
    if (existente) return existente.albumId

    const albumId = `favoritos-${crypto.randomUUID()}`
    const albumesFavoritos = [
      ...get().albumesFavoritos,
      { albumId, titulo: nombre, coverUrl: null, songIds: [], creadoEn: Date.now() },
    ]
    set({ albumesFavoritos })
    guardarAlbumes(albumesFavoritos)
    return albumId
  },

  editarAlbumFavorito: (albumId, cambios) => {
    const titulo = cambios.titulo.trim()
    if (!titulo) return false
    const tituloDuplicado = get().albumesFavoritos.some((album) => (
      album.albumId !== albumId
      && album.titulo.toLocaleLowerCase() === titulo.toLocaleLowerCase()
    ))
    if (tituloDuplicado) return false

    const albumesFavoritos = get().albumesFavoritos.map((album) => album.albumId === albumId
      ? {
        ...album,
        titulo,
        coverUrl: cambios.coverUrl?.trim() || null,
        songIds: Array.from(new Set(cambios.songIds)),
      }
      : album)
    set({ albumesFavoritos })
    guardarAlbumes(albumesFavoritos)
    return true
  },

  actualizarDestinos: (songId, guardarEnFavoritos, albumIds) => set((estado) => {
    const cancionesFavoritas = guardarEnFavoritos
      ? Array.from(new Set([...estado.cancionesFavoritas, songId]))
      : estado.cancionesFavoritas.filter((id) => id !== songId)
    const seleccionados = new Set(albumIds)
    const albumesFavoritos = estado.albumesFavoritos.map((album) => ({
      ...album,
      songIds: seleccionados.has(album.albumId)
        ? Array.from(new Set([...album.songIds, songId]))
        : album.songIds.filter((id) => id !== songId),
    }))
    guardarFavoritos(cancionesFavoritas)
    guardarAlbumes(albumesFavoritos)
    return { cancionesFavoritas, albumesFavoritos }
  }),
}))
