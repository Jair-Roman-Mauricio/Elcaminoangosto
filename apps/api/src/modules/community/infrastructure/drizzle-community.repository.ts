import { Inject, Injectable } from '@nestjs/common'
import { and, asc, count, desc, eq, gte, ilike, or } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { hiloRespuestas, hilos } from '../../shared/database/schema'
import {
  CommunityRepository,
  type HiloEntity,
  type HiloResumen,
  type RespuestaEntity,
} from '../domain/community.repository'

@Injectable()
export class DrizzleCommunityRepository extends CommunityRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async listarHilos({
    busqueda,
    limite,
    incluirOcultos,
  }: {
    busqueda: string | null
    limite: number
    incluirOcultos: boolean
  }): Promise<HiloResumen[]> {
    const condiciones = []
    if (!incluirOcultos) condiciones.push(eq(hilos.estado, 'VISIBLE'))
    if (busqueda) {
      const patron = `%${busqueda}%`
      condiciones.push(or(ilike(hilos.titulo, patron), ilike(hilos.cuerpo, patron))!)
    }

    return this.db
      .select({
        id: hilos.id,
        titulo: hilos.titulo,
        respuestas: hilos.respuestas,
        ultimaActividad: hilos.ultimaActividad,
        createdAt: hilos.createdAt,
      })
      .from(hilos)
      .where(condiciones.length ? and(...condiciones) : undefined)
      .orderBy(desc(hilos.ultimaActividad))
      .limit(limite)
  }

  async buscarHilo(id: string, incluirOcultos: boolean): Promise<HiloEntity | null> {
    const [fila] = await this.db.select().from(hilos).where(eq(hilos.id, id)).limit(1)
    if (!fila) return null
    if (!incluirOcultos && fila.estado !== 'VISIBLE') return null
    return fila
  }

  async respuestasDe(hiloId: string, incluirOcultas: boolean): Promise<RespuestaEntity[]> {
    return this.db
      .select()
      .from(hiloRespuestas)
      .where(
        incluirOcultas
          ? eq(hiloRespuestas.hiloId, hiloId)
          : and(eq(hiloRespuestas.hiloId, hiloId), eq(hiloRespuestas.estado, 'VISIBLE')),
      )
      .orderBy(asc(hiloRespuestas.createdAt))
  }

  async crearHilo(input: {
    titulo: string
    cuerpo: string
    autorHuella: string
  }): Promise<HiloEntity> {
    const [fila] = await this.db.insert(hilos).values(input).returning()
    return fila!
  }

  async responder(input: {
    hiloId: string
    cuerpo: string
    autorHuella: string
  }): Promise<RespuestaEntity> {
    const [fila] = await this.db.insert(hiloRespuestas).values(input).returning()
    return fila!
  }

  async publicacionesDesde(autorHuella: string, desde: Date): Promise<number> {
    // Hilos y respuestas cuentan para el mismo límite: quien inunda el foro lo
    // hace igual por un lado que por el otro.
    const [deHilos] = await this.db
      .select({ total: count() })
      .from(hilos)
      .where(and(eq(hilos.autorHuella, autorHuella), gte(hilos.createdAt, desde)))

    const [deRespuestas] = await this.db
      .select({ total: count() })
      .from(hiloRespuestas)
      .where(
        and(eq(hiloRespuestas.autorHuella, autorHuella), gte(hiloRespuestas.createdAt, desde)),
      )

    return (deHilos?.total ?? 0) + (deRespuestas?.total ?? 0)
  }

  async cambiarEstadoDeHilo(id: string, estado: 'VISIBLE' | 'OCULTO'): Promise<void> {
    await this.db.update(hilos).set({ estado }).where(eq(hilos.id, id))
  }

  async cambiarEstadoDeRespuesta(id: string, estado: 'VISIBLE' | 'OCULTO'): Promise<void> {
    await this.db.update(hiloRespuestas).set({ estado }).where(eq(hiloRespuestas.id, id))
  }

  async eliminarHilo(id: string): Promise<void> {
    await this.db.delete(hilos).where(eq(hilos.id, id))
  }
}
