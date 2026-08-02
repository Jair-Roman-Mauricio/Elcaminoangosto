import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, count, eq, type SQL } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { albums, artists, mediaAssets, songs } from '../../shared/database/schema'
import {
  MusicRepository,
  type AlbumEntity,
  type ArtistEntity,
  type SongEntity,
  type Tono,
} from '../domain/music.repository'

@Injectable()
export class DrizzleMusicRepository extends MusicRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  // ── Artistas ────────────────────────────────────────────────────────────

  async findArtists(): Promise<ArtistEntity[]> {
    return this.db
      .select({ id: artists.id, name: artists.name })
      .from(artists)
      .orderBy(asc(artists.name))
  }

  /**
   * El admin escribe el nombre del artista al subir la canción; no hay una
   * pantalla de artistas. Se reutiliza el existente para no duplicarlos.
   */
  async findOrCreateArtist(name: string): Promise<ArtistEntity> {
    const existentes = await this.db
      .select({ id: artists.id, name: artists.name })
      .from(artists)
      .where(eq(artists.name, name))
      .limit(1)
    if (existentes[0]) return existentes[0]

    const [fila] = await this.db.insert(artists).values({ name }).returning()
    if (!fila) throw new NotFoundException('No se pudo crear el artista')
    return { id: fila.id, name: fila.name }
  }

  // ── Álbumes ─────────────────────────────────────────────────────────────

  async findAlbums(): Promise<AlbumEntity[]> {
    return this.db
      .select({
        id: albums.id,
        artistId: albums.artistId,
        artistName: artists.name,
        title: albums.title,
        number: albums.number,
        description: albums.description,
        coverImageUrl: albums.coverImageUrl,
        tone: albums.tone,
        discColor: albums.discColor,
      })
      .from(albums)
      .innerJoin(artists, eq(albums.artistId, artists.id))
      .orderBy(asc(albums.number), asc(albums.title))
  }

  async findAlbumById(id: string): Promise<AlbumEntity | null> {
    return (await this.findAlbums()).find((a) => a.id === id) ?? null
  }

  async createAlbum(input: {
    artistId: string
    title: string
    number: string | null
    description: string | null
    coverImageUrl: string | null
    tone: Tono
    discColor: string | null
  }): Promise<AlbumEntity> {
    const [fila] = await this.db.insert(albums).values(input).returning({ id: albums.id })
    if (!fila) throw new NotFoundException('No se pudo crear el álbum')
    const creado = await this.findAlbumById(fila.id)
    if (!creado) throw new NotFoundException('No se pudo crear el álbum')
    return creado
  }

  async updateAlbum(
    id: string,
    cambios: Parameters<MusicRepository['updateAlbum']>[1],
  ): Promise<AlbumEntity> {
    await this.db.update(albums).set(cambios).where(eq(albums.id, id))
    const actualizado = await this.findAlbumById(id)
    if (!actualizado) throw new NotFoundException('Álbum no encontrado')
    return actualizado
  }

  async removeAlbum(id: string): Promise<void> {
    await this.db.delete(albums).where(eq(albums.id, id))
  }

  async countSongsInAlbum(albumId: string): Promise<number> {
    const filas = await this.db
      .select({ n: count() })
      .from(songs)
      .where(eq(songs.albumId, albumId))
    return filas[0]?.n ?? 0
  }

  // ── Canciones ───────────────────────────────────────────────────────────

  async findPublishedSongs(): Promise<SongEntity[]> {
    return this.consultaDeCanciones(
      and(eq(songs.isPublished, true), eq(mediaAssets.status, 'READY')),
    )
  }

  async findAllSongs(): Promise<SongEntity[]> {
    return this.consultaDeCanciones(undefined)
  }

  async findSongById(id: string): Promise<SongEntity | null> {
    const filas = await this.consultaDeCanciones(eq(songs.id, id))
    return filas[0] ?? null
  }

  async createSong(input: Parameters<MusicRepository['createSong']>[0]): Promise<SongEntity> {
    // Nace sin publicar: el admin la revisa y la publica cuando quiere.
    const [fila] = await this.db
      .insert(songs)
      .values({ ...input, isPublished: false })
      .returning({ id: songs.id })
    if (!fila) throw new NotFoundException('No se pudo crear la canción')
    const creada = await this.findSongById(fila.id)
    if (!creada) throw new NotFoundException('No se pudo crear la canción')
    return creada
  }

  async setSongPublished(id: string, isPublished: boolean): Promise<SongEntity> {
    await this.db.update(songs).set({ isPublished }).where(eq(songs.id, id))
    const actualizada = await this.findSongById(id)
    if (!actualizada) throw new NotFoundException('Canción no encontrada')
    return actualizada
  }

  async removeSong(id: string): Promise<void> {
    await this.db.delete(songs).where(eq(songs.id, id))
  }

  /** Listado unido al artista; el `where` decide qué se incluye. */
  private async consultaDeCanciones(filtro: SQL | undefined): Promise<SongEntity[]> {
    const consulta = this.db
      .select({
        id: songs.id,
        albumId: songs.albumId,
        artistId: songs.artistId,
        artistName: artists.name,
        title: songs.title,
        subtitle: songs.subtitle,
        trackNumber: songs.trackNumber,
        audioAssetId: songs.audioAssetId,
        durationSeconds: songs.durationSeconds,
        isPublished: songs.isPublished,
        tone: songs.tone,
        backgroundUrl: songs.backgroundUrl,
        backgroundAssetId: songs.backgroundAssetId,
        backgroundType: songs.backgroundType,
        subtitlesSrt: songs.subtitlesSrt,
      })
      .from(songs)
      .innerJoin(artists, eq(songs.artistId, artists.id))
      .leftJoin(mediaAssets, eq(songs.audioAssetId, mediaAssets.id))
      .orderBy(asc(songs.albumId), asc(songs.trackNumber))

    return filtro ? consulta.where(filtro) : consulta
  }
}
