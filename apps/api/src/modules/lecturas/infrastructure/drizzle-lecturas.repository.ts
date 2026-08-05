import { Inject, Injectable } from '@nestjs/common'
import { and, count, desc, eq, gte, ne } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { lecturaComentarios, lecturas, oracionesGuiadas } from '../../shared/database/schema'
import {
  LecturasRepository,
  type ComentarioDeLecturaEntity,
  type EstadoDePublicacion,
  type LecturaEntity,
  type OracionEntity,
  type TipoDeLectura,
} from '../domain/lecturas.repository'

type Cambios<T> = { [K in keyof T]?: T[K] | undefined }

@Injectable()
export class DrizzleLecturasRepository extends LecturasRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  // Lo más nuevo arriba. `nulls last` deja al final lo que aún no se publicó.
  async lecturas(tipo: TipoDeLectura, incluirOcultas: boolean): Promise<LecturaEntity[]> {
    return this.db
      .select()
      .from(lecturas)
      .where(
        incluirOcultas
          ? eq(lecturas.tipo, tipo)
          : and(eq(lecturas.tipo, tipo), eq(lecturas.estado, 'VISIBLE')),
      )
      .orderBy(desc(lecturas.publishedAt), desc(lecturas.createdAt))
  }

  async lectura(id: string, incluirOcultas: boolean): Promise<LecturaEntity | null> {
    const [fila] = await this.db
      .select()
      .from(lecturas)
      .where(
        incluirOcultas
          ? eq(lecturas.id, id)
          : and(eq(lecturas.id, id), eq(lecturas.estado, 'VISIBLE')),
      )
      .limit(1)
    return fila ?? null
  }

  async crearLectura(
    input: Omit<LecturaEntity, 'id' | 'estado' | 'createdAt'>,
  ): Promise<LecturaEntity> {
    const [fila] = await this.db.insert(lecturas).values(input).returning()
    return fila!
  }

  async editarLectura(
    id: string,
    cambios: Cambios<Omit<LecturaEntity, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await this.db.update(lecturas).set(cambios).where(eq(lecturas.id, id))
  }

  async eliminarLectura(id: string): Promise<void> {
    await this.db.delete(lecturas).where(eq(lecturas.id, id))
  }

  // Se piden de más y se ordenan en memoria: son pocas filas y así la
  // preferencia por la misma sección se lee de un vistazo en el servicio.
  async relacionadas(input: {
    excluir: string
    tipo: TipoDeLectura
    seccion: string | null
    limite: number
  }): Promise<LecturaEntity[]> {
    const filas = await this.db
      .select()
      .from(lecturas)
      .where(
        and(
          eq(lecturas.tipo, input.tipo),
          eq(lecturas.estado, 'VISIBLE'),
          ne(lecturas.id, input.excluir),
        ),
      )
      .orderBy(desc(lecturas.publishedAt), desc(lecturas.createdAt))
      .limit(input.limite * 4)

    const mismaSeccion = filas.filter((f) => input.seccion && f.seccion === input.seccion)
    const otras = filas.filter((f) => !mismaSeccion.includes(f))
    return [...mismaSeccion, ...otras].slice(0, input.limite)
  }

  // ── Conversación bajo un artículo ────────────────────────────────────────

  async comentariosDe(
    lecturaId: string,
    incluirOcultos: boolean,
  ): Promise<ComentarioDeLecturaEntity[]> {
    return this.db
      .select()
      .from(lecturaComentarios)
      .where(
        incluirOcultos
          ? eq(lecturaComentarios.lecturaId, lecturaId)
          : and(
              eq(lecturaComentarios.lecturaId, lecturaId),
              eq(lecturaComentarios.estado, 'VISIBLE'),
            ),
      )
      .orderBy(desc(lecturaComentarios.createdAt))
  }

  async comentar(input: {
    lecturaId: string
    cuerpo: string
    autorHuella: string
  }): Promise<ComentarioDeLecturaEntity> {
    const [fila] = await this.db.insert(lecturaComentarios).values(input).returning()
    return fila!
  }

  async comentariosDesde(autorHuella: string, desde: Date): Promise<number> {
    const [fila] = await this.db
      .select({ total: count() })
      .from(lecturaComentarios)
      .where(
        and(
          eq(lecturaComentarios.autorHuella, autorHuella),
          gte(lecturaComentarios.createdAt, desde),
        ),
      )
    return fila?.total ?? 0
  }

  async cambiarEstadoDeComentario(id: string, estado: EstadoDePublicacion): Promise<void> {
    await this.db.update(lecturaComentarios).set({ estado }).where(eq(lecturaComentarios.id, id))
  }

  // ── Oraciones guiadas ────────────────────────────────────────────────────

  async oraciones(incluirOcultas: boolean): Promise<OracionEntity[]> {
    return this.db
      .select()
      .from(oracionesGuiadas)
      .where(incluirOcultas ? undefined : eq(oracionesGuiadas.estado, 'VISIBLE'))
      .orderBy(desc(oracionesGuiadas.publishedAt), desc(oracionesGuiadas.createdAt))
  }

  async oracion(id: string, incluirOcultas: boolean): Promise<OracionEntity | null> {
    const [fila] = await this.db
      .select()
      .from(oracionesGuiadas)
      .where(
        incluirOcultas
          ? eq(oracionesGuiadas.id, id)
          : and(eq(oracionesGuiadas.id, id), eq(oracionesGuiadas.estado, 'VISIBLE')),
      )
      .limit(1)
    return fila ?? null
  }

  async crearOracion(
    input: Omit<OracionEntity, 'id' | 'estado' | 'createdAt'>,
  ): Promise<OracionEntity> {
    const [fila] = await this.db.insert(oracionesGuiadas).values(input).returning()
    return fila!
  }

  async editarOracion(
    id: string,
    cambios: Cambios<Omit<OracionEntity, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await this.db.update(oracionesGuiadas).set(cambios).where(eq(oracionesGuiadas.id, id))
  }

  async eliminarOracion(id: string): Promise<void> {
    await this.db.delete(oracionesGuiadas).where(eq(oracionesGuiadas.id, id))
  }
}
