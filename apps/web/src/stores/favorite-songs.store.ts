import { create } from 'zustand'
import {
  abrirColeccion,
  crearAlbumEnServidor,
  editarAlbumEnServidor,
  marcarCancionEnServidor,
} from '../modules/music/coleccion-api'

const CLAVE_FAVORITOS = 'elcamino:alabanzas:favoritos'
const CLAVE_ALBUMES = 'elcamino:alabanzas:albumes-favoritos'
const CLAVE_CODIGO = 'elcamino:alabanzas:codigo'

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
  /** Código de respaldo. `null` mientras no se haya creado ningún álbum. */
  codigo: string | null
  /** Se pone al crear la colección, para enseñarlo una sola vez. */
  codigoReciente: string | null
  hidratarFavoritos: () => void
  crearAlbumFavorito: (titulo: string) => string | null
  editarAlbumFavorito: (albumId: string, cambios: CambiosDeAlbumFavorito) => boolean
  actualizarDestinos: (songId: string, guardarEnFavoritos: boolean, albumIds: string[]) => void
  olvidarCodigoReciente: () => void
  /** Trae la colección de ese código y sustituye la de este navegador. */
  restaurarConCodigo: (codigo: string) => Promise<boolean>
}

function guardarCodigo(codigo: string | null) {
  try {
    if (codigo) window.localStorage.setItem(CLAVE_CODIGO, codigo)
    else window.localStorage.removeItem(CLAVE_CODIGO)
  } catch {
    // Sin almacenamiento el respaldo no persiste, pero la sesión sigue.
  }
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
  codigo: null,
  codigoReciente: null,

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
      const codigo = window.localStorage.getItem(CLAVE_CODIGO)
      set({ cancionesFavoritas, albumesFavoritos, hidratado: true, codigo })
    } catch {
      set({ hidratado: true })
    }
  },

  crearAlbumFavorito: (titulo) => {
    const nombre = titulo.trim()
    if (!nombre) return null
    const existente = get().albumesFavoritos.find((album) => album.titulo.toLocaleLowerCase() === nombre.toLocaleLowerCase())
    if (existente) return existente.albumId

    // El álbum aparece al instante con un id local: crear una lista no debe
    // esperar a la red. El servidor manda su id de vuelta y se sustituye.
    const albumId = `favoritos-${crypto.randomUUID()}`
    const albumesFavoritos = [
      ...get().albumesFavoritos,
      { albumId, titulo: nombre, coverUrl: null, songIds: [], creadoEn: Date.now() },
    ]
    set({ albumesFavoritos })
    guardarAlbumes(albumesFavoritos)

    void crearAlbumEnServidor(nombre, get().codigo)
      .then(({ album, codigo }) => {
        const conIdDelServidor = get().albumesFavoritos.map((a) =>
          a.albumId === albumId ? { ...a, albumId: album.albumId } : a,
        )
        set({ albumesFavoritos: conIdDelServidor })
        guardarAlbumes(conIdDelServidor)
        if (codigo) {
          guardarCodigo(codigo)
          set({ codigo, codigoReciente: codigo })
        }
      })
      .catch(() => {
        // El respaldo es una mejora: si el servidor no responde, el álbum
        // sigue existiendo en este navegador.
      })

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

    const codigo = get().codigo
    if (codigo) {
      void editarAlbumEnServidor(codigo, albumId, {
        titulo,
        coverUrl: cambios.coverUrl?.trim() || null,
        songIds: Array.from(new Set(cambios.songIds)),
      }).catch(() => undefined)
    }
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

    if (estado.codigo) {
      void marcarCancionEnServidor(estado.codigo, songId, guardarEnFavoritos).catch(() => undefined)
      for (const album of albumesFavoritos) {
        void editarAlbumEnServidor(estado.codigo, album.albumId, {
          titulo: album.titulo,
          coverUrl: album.coverUrl,
          songIds: album.songIds,
        }).catch(() => undefined)
      }
    }
    return { cancionesFavoritas, albumesFavoritos }
  }),

  olvidarCodigoReciente: () => set({ codigoReciente: null }),

  restaurarConCodigo: async (codigo) => {
    const limpio = codigo.trim().toUpperCase()
    if (!limpio) return false
    try {
      const contenido = await abrirColeccion(limpio)
      const albumesFavoritos: AlbumFavoritoDelUsuario[] = contenido.albumesPersonales.map(
        (album, indice) => ({
          albumId: album.albumId,
          titulo: album.titulo,
          coverUrl: album.coverUrl,
          songIds: album.songIds,
          creadoEn: Date.now() + indice,
        }),
      )
      set({
        cancionesFavoritas: contenido.cancionesFavoritas,
        albumesFavoritos,
        codigo: limpio,
      })
      guardarFavoritos(contenido.cancionesFavoritas)
      guardarAlbumes(albumesFavoritos)
      guardarCodigo(limpio)
      return true
    } catch {
      return false
    }
  },
}))
