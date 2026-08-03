import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import {
  coleccionAlbumCanciones,
  coleccionAlbumes,
  coleccionFavoritos,
  colecciones,
} from '../../shared/database/schema'
import {
  ColeccionRepository,
  type AlbumPersonalEntity,
  type ColeccionEntity,
} from '../domain/music.repository'

@Injectable()
export class DrizzleColeccionRepository extends ColeccionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async buscarPorHuella(huella: string): Promise<string | null> {
    const [fila] = await this.db
      .select({ id: colecciones.id })
      .from(colecciones)
      .where(eq(colecciones.codigoHuella, huella))
      .limit(1)
    return fila?.id ?? null
  }

  async crear(huella: string): Promise<string | null> {
    // `onConflictDoNothing` deja la decisión en la base: dos personas que
    // eligen el mismo código a la vez no pueden acabar compartiendo colección.
    const [fila] = await this.db
      .insert(colecciones)
      .values({ codigoHuella: huella })
      .onConflictDoNothing()
      .returning({ id: colecciones.id })
    return fila?.id ?? null
  }

  async contenido(coleccionId: string): Promise<ColeccionEntity> {
    const favoritas = await this.db
      .select({ songId: coleccionFavoritos.songId })
      .from(coleccionFavoritos)
      .where(eq(coleccionFavoritos.coleccionId, coleccionId))

    const albumes = await this.db
      .select()
      .from(coleccionAlbumes)
      .where(eq(coleccionAlbumes.coleccionId, coleccionId))
      .orderBy(asc(coleccionAlbumes.createdAt))

    const ids = albumes.map((a) => a.id)
    const canciones = ids.length
      ? await this.db
          .select()
          .from(coleccionAlbumCanciones)
          .where(inArray(coleccionAlbumCanciones.albumId, ids))
          .orderBy(asc(coleccionAlbumCanciones.orden))
      : []

    return {
      cancionesFavoritas: favoritas.map((f) => f.songId),
      albumesPersonales: albumes.map((a) => ({
        albumId: a.id,
        titulo: a.nombre,
        coverUrl: a.portadaUrl,
        songIds: canciones.filter((c) => c.albumId === a.id).map((c) => c.songId),
      })),
    }
  }

  async marcarCancion(coleccionId: string, songId: string, favorita: boolean): Promise<void> {
    if (favorita) {
      await this.db
        .insert(coleccionFavoritos)
        .values({ coleccionId, songId })
        .onConflictDoNothing()
      return
    }
    await this.db
      .delete(coleccionFavoritos)
      .where(
        and(eq(coleccionFavoritos.coleccionId, coleccionId), eq(coleccionFavoritos.songId, songId)),
      )
  }

  async crearAlbum(coleccionId: string, titulo: string): Promise<AlbumPersonalEntity> {
    const [fila] = await this.db
      .insert(coleccionAlbumes)
      .values({ coleccionId, nombre: titulo })
      .returning()
    return { albumId: fila!.id, titulo: fila!.nombre, coverUrl: fila!.portadaUrl, songIds: [] }
  }

  async actualizarAlbum(
    coleccionId: string,
    albumId: string,
    cambios: { titulo: string; coverUrl: string | null; songIds: string[] },
  ): Promise<AlbumPersonalEntity> {
    const [fila] = await this.db
      .update(coleccionAlbumes)
      .set({ nombre: cambios.titulo, portadaUrl: cambios.coverUrl })
      .where(
        and(eq(coleccionAlbumes.id, albumId), eq(coleccionAlbumes.coleccionId, coleccionId)),
      )
      .returning()
    if (!fila) throw new NotFoundException('Álbum no encontrado')

    // El contenido se reemplaza entero: es una lista ordenada, y calcular el
    // diferencial costaría más que reescribirla.
    await this.db
      .delete(coleccionAlbumCanciones)
      .where(eq(coleccionAlbumCanciones.albumId, albumId))
    if (cambios.songIds.length) {
      await this.db
        .insert(coleccionAlbumCanciones)
        .values(cambios.songIds.map((songId, orden) => ({ albumId, songId, orden })))
    }

    return {
      albumId: fila.id,
      titulo: fila.nombre,
      coverUrl: fila.portadaUrl,
      songIds: cambios.songIds,
    }
  }

  async eliminarAlbum(coleccionId: string, albumId: string): Promise<void> {
    await this.db
      .delete(coleccionAlbumes)
      .where(and(eq(coleccionAlbumes.id, albumId), eq(coleccionAlbumes.coleccionId, coleccionId)))
  }

  async esDe(coleccionId: string, albumId: string): Promise<boolean> {
    const [fila] = await this.db
      .select({ id: coleccionAlbumes.id })
      .from(coleccionAlbumes)
      .where(and(eq(coleccionAlbumes.id, albumId), eq(coleccionAlbumes.coleccionId, coleccionId)))
      .limit(1)
    return Boolean(fila)
  }
}
