import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  MusicRepository,
  type AlbumEntity,
  type SongEntity,
  type TipoDeFondo,
  type Tono,
} from '../domain/music.repository'
import { MediaService } from '../../media'
import type { Actor } from '../../shared'

/** Álbum tal como lo consume la pantalla de Alabanza. */
export interface AlbumCard {
  albumId: string
  numero: string
  titulo: string
  descripcion: string
  coverUrl: string
  tono: Tono
  discColor: string
}

/** Canción con su audio ya firmado, lista para reproducir. */
export interface SongCard {
  songId: string
  albumId: string | null
  numero: string
  titulo: string
  subtitulo: string
  artista: string
  audioUrl: string
  coverUrl: string
  durationSeconds: number | null
  tono: Tono
  fondo: { tipo: TipoDeFondo; url: string } | null
  /** Contenido del `.srt`; el cliente lo interpreta y lo pinta. */
  subtitulos: string | null
}

/** Canción como la ve el admin: incluye las no publicadas. */
export interface AdminSong {
  id: string
  title: string
  subtitle: string | null
  artistName: string
  albumId: string | null
  albumTitle: string | null
  trackNumber: number | null
  durationSeconds: number | null
  isPublished: boolean
  tone: Tono
}

/** Valor por defecto del disco cuando el álbum no lo define. */
const COLOR_DE_DISCO = '#111114'

/**
 * API pública del bounded context `music` (HU-9.2).
 *
 * El catálogo de Alabanza vivía en un fichero del cliente; aquí pasa a ser
 * contenido que el ADMIN publica. El audio vive en `media` y se sirve firmado.
 */
@Injectable()
export class MusicService {
  constructor(
    private readonly music: MusicRepository,
    private readonly media: MediaService,
  ) {}

  /** Catálogo de Alabanza: álbumes y canciones publicadas, para cualquiera. */
  async catalogo(): Promise<{ albumes: AlbumCard[]; canciones: SongCard[] }> {
    const [albumes, canciones] = await Promise.all([
      this.music.findAlbums(),
      this.music.findPublishedSongs(),
    ])
    const portadaDe = new Map(albumes.map((a) => [a.id, a.coverImageUrl ?? '']))

    const tarjetas = await Promise.all(
      // El repositorio ya excluye borradores y medios que no están READY.
      // Sin audio no hay canción que reproducir: se descarta del catálogo.
      canciones
        .filter((c) => c.audioAssetId !== null)
        .map(async (c) => this.aSongCard(c, portadaDe.get(c.albumId ?? '') ?? '')),
    )
    const albumesVisibles = new Set(tarjetas.flatMap((c) => (c.albumId ? [c.albumId] : [])))

    return {
      // Un álbum sin contenido público no revela su metadata en el catálogo
      // anónimo; el módulo admin sigue consultando la colección completa.
      albumes: albumes.filter((a) => albumesVisibles.has(a.id)).map((a) => this.aAlbumCard(a)),
      canciones: tarjetas,
    }
  }

  // ── Administración de contenido (solo ADMIN) ──────────────────────────────

  async listarParaAdmin(actor: Actor): Promise<{ albumes: AlbumCard[]; canciones: AdminSong[] }> {
    this.exigirAdmin(actor)
    const [albumes, canciones] = await Promise.all([
      this.music.findAlbums(),
      this.music.findAllSongs(),
    ])
    const tituloDe = new Map(albumes.map((a) => [a.id, a.title]))

    return {
      albumes: albumes.map((a) => this.aAlbumCard(a)),
      canciones: canciones.map((c) => ({
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        artistName: c.artistName,
        albumId: c.albumId,
        albumTitle: c.albumId ? (tituloDe.get(c.albumId) ?? null) : null,
        trackNumber: c.trackNumber,
        durationSeconds: c.durationSeconds,
        isPublished: c.isPublished,
        tone: c.tone,
      })),
    }
  }

  /** Crea un álbum. El artista se reutiliza si ya existe con ese nombre. */
  async crearAlbum(
    actor: Actor,
    input: {
      title: string
      artistName: string
      number: string | null
      description: string | null
      coverImageUrl: string | null
      tone: Tono
      discColor: string | null
    },
  ): Promise<AlbumCard> {
    this.exigirAdmin(actor)
    const artista = await this.music.findOrCreateArtist(input.artistName.trim())
    const album = await this.music.createAlbum({ ...input, artistId: artista.id })
    return this.aAlbumCard(album)
  }

  /** Corrige los datos de un álbum ya creado. */
  async editarAlbum(
    actor: Actor,
    albumId: string,
    cambios: {
      title?: string | undefined
      number?: string | null | undefined
      description?: string | null | undefined
      coverImageUrl?: string | null | undefined
      tone?: Tono | undefined
      discColor?: string | null | undefined
    },
  ): Promise<AlbumCard> {
    this.exigirAdmin(actor)
    const album = await this.music.findAlbumById(albumId)
    if (!album) throw new NotFoundException('Álbum no encontrado')
    return this.aAlbumCard(await this.music.updateAlbum(albumId, cambios))
  }

  /**
   * Un álbum con canciones no se borra: primero hay que mover o eliminar su
   * contenido, para no dejar canciones huérfanas sin portada ni identidad.
   */
  async eliminarAlbum(actor: Actor, albumId: string): Promise<void> {
    this.exigirAdmin(actor)
    const album = await this.music.findAlbumById(albumId)
    if (!album) throw new NotFoundException('Álbum no encontrado')

    const canciones = await this.music.countSongsInAlbum(albumId)
    if (canciones > 0) {
      throw new BadRequestException(`El álbum tiene ${canciones} canción(es); elimínalas primero`)
    }
    await this.music.removeAlbum(albumId)
  }

  /** Publica una canción ya subida. Nace despublicada hasta que se revisa. */
  async crearCancion(
    actor: Actor,
    input: {
      title: string
      artistName: string
      albumId: string | null
      subtitle: string | null
      trackNumber: number | null
      audioAssetId: string
      durationSeconds: number | null
      tone: Tono
      backgroundUrl: string | null
      backgroundAssetId: string | null
      backgroundType: TipoDeFondo | null
      subtitlesSrt: string | null
    },
  ): Promise<SongEntity> {
    this.exigirAdmin(actor)

    const asset = await this.media.estado(input.audioAssetId)
    if (asset.kind !== 'AUDIO') {
      throw new BadRequestException('Una canción necesita un archivo de audio')
    }
    if (asset.ownerId !== actor.id) {
      throw new ForbiddenException('Ese audio no es tuyo')
    }
    if (input.backgroundAssetId) {
      const fondo = await this.media.estado(input.backgroundAssetId)
      if (fondo.kind !== 'VIDEO') {
        throw new BadRequestException('El fondo en video debe ser un archivo de video')
      }
      if (fondo.ownerId !== actor.id) {
        throw new ForbiddenException('Ese fondo no es tuyo')
      }
    }
    if (input.albumId && !(await this.music.findAlbumById(input.albumId))) {
      throw new NotFoundException('Álbum no encontrado')
    }

    const artista = await this.music.findOrCreateArtist(input.artistName.trim())
    return this.music.createSong({ ...input, artistId: artista.id })
  }

  async publicarCancion(actor: Actor, songId: string, publicar: boolean): Promise<SongEntity> {
    this.exigirAdmin(actor)
    const cancion = await this.cancionExistente(songId)
    if (cancion.isPublished === publicar) {
      throw new BadRequestException('La canción ya está en ese estado')
    }
    return this.music.setSongPublished(songId, publicar)
  }

  /** Elimina la canción y su audio: primero la fila, que referencia el asset. */
  async eliminarCancion(actor: Actor, songId: string): Promise<void> {
    this.exigirAdmin(actor)
    const cancion = await this.cancionExistente(songId)

    await this.music.removeSong(songId)
    if (cancion.audioAssetId) await this.media.eliminar(cancion.audioAssetId)
    if (cancion.backgroundAssetId) await this.media.eliminar(cancion.backgroundAssetId)
  }

  private async cancionExistente(songId: string): Promise<SongEntity> {
    const cancion = await this.music.findSongById(songId)
    if (!cancion) throw new NotFoundException('Canción no encontrada')
    return cancion
  }

  private exigirAdmin(actor: Actor): void {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un admin administra la música')
    }
  }

  private aAlbumCard(a: AlbumEntity): AlbumCard {
    return {
      albumId: a.id,
      numero: a.number ?? '',
      titulo: a.title,
      descripcion: a.description ?? '',
      coverUrl: a.coverImageUrl ?? '',
      tono: a.tone,
      discColor: a.discColor ?? COLOR_DE_DISCO,
    }
  }

  private async aSongCard(c: SongEntity, coverUrl: string): Promise<SongCard> {
    return {
      songId: c.id,
      albumId: c.albumId,
      numero: c.trackNumber ? String(c.trackNumber).padStart(2, '0') : '',
      titulo: c.title,
      subtitulo: c.subtitle ?? '',
      artista: c.artistName,
      // El audio es privado: se sirve firmado, sin exigir transcodificación.
      audioUrl: (await this.media.urlDeOrigen(c.audioAssetId!, true)) ?? '',
      coverUrl,
      durationSeconds: c.durationSeconds,
      tono: c.tone,
      fondo: await this.fondoDe(c),
      subtitulos: c.subtitlesSrt,
    }
  }

  /**
   * El fondo vive en un sitio distinto según su tipo: la imagen es una URL
   * pública y el video un medio privado que hay que firmar.
   */
  private async fondoDe(c: SongEntity): Promise<{ tipo: TipoDeFondo; url: string } | null> {
    if (c.backgroundAssetId) {
      const url = await this.media.urlDeLectura(c.backgroundAssetId, true).catch(() => null)
      return url ? { tipo: 'video', url } : null
    }
    return c.backgroundUrl ? { tipo: 'imagen', url: c.backgroundUrl } : null
  }
}
