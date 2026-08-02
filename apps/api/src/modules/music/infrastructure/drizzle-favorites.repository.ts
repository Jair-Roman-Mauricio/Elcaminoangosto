import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { playlistSongs, playlists, songLikes } from '../../shared/database/schema'
import {
  FavoritesRepository,
  type AlbumPersonalEntity,
  type FavoritosEntity,
} from '../domain/music.repository'

/**
 * Los favoritos se apoyan en las tablas que ya existían en el esquema:
 * `song_likes` para las canciones sueltas y `playlists` (+ `playlist_songs`)
 * para los álbumes personales.
 */
@Injectable()
export class DrizzleFavoritesRepository extends FavoritesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async favoritosDe(userId: string): Promise<FavoritosEntity> {
    const [likes, listas] = await Promise.all([
      this.db
        .select({ songId: songLikes.songId })
        .from(songLikes)
        .where(eq(songLikes.userId, userId)),
      this.db
        .select({
          albumId: playlists.id,
          titulo: playlists.title,
          coverUrl: playlists.coverUrl,
        })
        .from(playlists)
        .where(eq(playlists.ownerId, userId))
        .orderBy(asc(playlists.createdAt)),
    ])

    const canciones = await this.db
      .select({ playlistId: playlistSongs.playlistId, songId: playlistSongs.songId })
      .from(playlistSongs)
      .innerJoin(playlists, eq(playlists.id, playlistSongs.playlistId))
      .where(eq(playlists.ownerId, userId))
      .orderBy(asc(playlistSongs.orderIndex))

    return {
      cancionesFavoritas: likes.map((l) => l.songId),
      albumesPersonales: listas.map((lista) => ({
        ...lista,
        songIds: canciones.filter((c) => c.playlistId === lista.albumId).map((c) => c.songId),
      })),
    }
  }

  async marcarCancion(userId: string, songId: string, favorita: boolean): Promise<void> {
    if (!favorita) {
      await this.db
        .delete(songLikes)
        .where(and(eq(songLikes.userId, userId), eq(songLikes.songId, songId)))
      return
    }
    // Repetir «me gusta» no debe fallar: la clave primaria es (song, user).
    await this.db.insert(songLikes).values({ userId, songId }).onConflictDoNothing()
  }

  async crearAlbumPersonal(userId: string, titulo: string): Promise<AlbumPersonalEntity> {
    const [fila] = await this.db
      .insert(playlists)
      .values({ ownerId: userId, title: titulo })
      .returning({ id: playlists.id, titulo: playlists.title, coverUrl: playlists.coverUrl })
    if (!fila) throw new NotFoundException('No se pudo crear el álbum')
    return { albumId: fila.id, titulo: fila.titulo, coverUrl: fila.coverUrl, songIds: [] }
  }

  async actualizarAlbumPersonal(
    userId: string,
    albumId: string,
    cambios: { titulo: string; coverUrl: string | null; songIds: string[] },
  ): Promise<AlbumPersonalEntity> {
    await this.db
      .update(playlists)
      .set({ title: cambios.titulo, coverUrl: cambios.coverUrl })
      .where(and(eq(playlists.id, albumId), eq(playlists.ownerId, userId)))

    // El contenido se reemplaza entero: es como lo edita la pantalla, y así el
    // orden queda siempre coherente con lo que envió el cliente.
    await this.db.delete(playlistSongs).where(eq(playlistSongs.playlistId, albumId))
    if (cambios.songIds.length > 0) {
      await this.db.insert(playlistSongs).values(
        cambios.songIds.map((songId, orderIndex) => ({ playlistId: albumId, songId, orderIndex })),
      )
    }

    return { albumId, titulo: cambios.titulo, coverUrl: cambios.coverUrl, songIds: cambios.songIds }
  }

  async eliminarAlbumPersonal(userId: string, albumId: string): Promise<void> {
    await this.db
      .delete(playlists)
      .where(and(eq(playlists.id, albumId), eq(playlists.ownerId, userId)))
  }

  async esDe(userId: string, albumId: string): Promise<boolean> {
    const filas = await this.db
      .select({ id: playlists.id })
      .from(playlists)
      .where(and(eq(playlists.id, albumId), eq(playlists.ownerId, userId)))
      .limit(1)
    return filas.length > 0
  }
}
