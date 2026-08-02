/** Entidades de dominio. TypeScript puro: sin Nest, sin Drizzle. */

/** Identidad visual de un álbum o canción en la pantalla de Alabanza. */
export type Tono = 'vino' | 'marfil' | 'azul'

/** Qué se ve mientras suena una canción. */
export type TipoDeFondo = 'imagen' | 'video'

export interface ArtistEntity {
  id: string
  name: string
}

export interface AlbumEntity {
  id: string
  artistId: string
  artistName: string
  title: string
  /** Número de catálogo visible: A01, A02… */
  number: string | null
  description: string | null
  coverImageUrl: string | null
  tone: Tono
  /** Color del vinilo en la portada animada. */
  discColor: string | null
}

export interface SongEntity {
  id: string
  albumId: string | null
  artistId: string
  artistName: string
  title: string
  subtitle: string | null
  /** Posición dentro del álbum. */
  trackNumber: number | null
  audioAssetId: string | null
  durationSeconds: number | null
  isPublished: boolean
  tone: Tono
  /** Fondo de imagen: URL pública. */
  backgroundUrl: string | null
  /** Fondo de video: medio privado. */
  backgroundAssetId: string | null
  backgroundType: TipoDeFondo | null
  /** Contenido del `.srt` con la letra. */
  subtitlesSrt: string | null
}

export abstract class MusicRepository {
  // ── Artistas ──────────────────────────────────────────────────────────────
  abstract findArtists(): Promise<ArtistEntity[]>
  /** Devuelve el artista con ese nombre, creándolo si no existía. */
  abstract findOrCreateArtist(name: string): Promise<ArtistEntity>

  // ── Álbumes ───────────────────────────────────────────────────────────────
  abstract findAlbums(): Promise<AlbumEntity[]>
  abstract findAlbumById(id: string): Promise<AlbumEntity | null>
  abstract createAlbum(input: {
    artistId: string
    title: string
    number: string | null
    description: string | null
    coverImageUrl: string | null
    tone: Tono
    discColor: string | null
  }): Promise<AlbumEntity>
  /** Corrige los datos del álbum. Las canciones no se tocan aquí. */
  abstract updateAlbum(
    id: string,
    cambios: {
      title?: string | undefined
      number?: string | null | undefined
      description?: string | null | undefined
      coverImageUrl?: string | null | undefined
      tone?: Tono | undefined
      discColor?: string | null | undefined
    },
  ): Promise<AlbumEntity>

  abstract removeAlbum(id: string): Promise<void>
  /** Nº de canciones del álbum: un álbum con canciones no se borra. */
  abstract countSongsInAlbum(albumId: string): Promise<number>

  // ── Canciones ─────────────────────────────────────────────────────────────
  /** Publicadas, ordenadas por álbum y pista (catálogo del estudiante). */
  abstract findPublishedSongs(): Promise<SongEntity[]>
  /** Todas, en cualquier estado (módulo Contenido). */
  abstract findAllSongs(): Promise<SongEntity[]>
  abstract findSongById(id: string): Promise<SongEntity | null>
  abstract createSong(input: {
    albumId: string | null
    artistId: string
    title: string
    subtitle: string | null
    trackNumber: number | null
    audioAssetId: string
    durationSeconds: number | null
    tone: Tono
    backgroundUrl: string | null
    backgroundAssetId: string | null
    backgroundType: TipoDeFondo | null
    subtitlesSrt: string | null
  }): Promise<SongEntity>
  abstract setSongPublished(id: string, isPublished: boolean): Promise<SongEntity>
  abstract removeSong(id: string): Promise<void>
}
