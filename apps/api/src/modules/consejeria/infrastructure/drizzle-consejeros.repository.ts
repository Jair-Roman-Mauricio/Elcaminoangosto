import { Inject, Injectable } from '@nestjs/common'
import { asc, desc, eq } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { consejeros } from '../../shared/database/schema'
import {
  ConsejerosRepository,
  type ConsejeroEntity,
} from '../domain/consejeros.repository'

type Cambios<T> = { [K in keyof T]?: T[K] | undefined }

@Injectable()
export class DrizzleConsejerosRepository extends ConsejerosRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  // Los de urgencias primero: quien llega al borde no debería leer la lista
  // entera para saber a quién llamar ahora.
  async listar(incluirOcultos: boolean): Promise<ConsejeroEntity[]> {
    return this.db
      .select()
      .from(consejeros)
      .where(incluirOcultos ? undefined : eq(consejeros.estado, 'VISIBLE'))
      .orderBy(desc(consejeros.atiendeUrgencias), asc(consejeros.orden), asc(consejeros.createdAt))
  }

  async porId(id: string): Promise<ConsejeroEntity | null> {
    const [fila] = await this.db.select().from(consejeros).where(eq(consejeros.id, id)).limit(1)
    return fila ?? null
  }

  async crear(input: Omit<ConsejeroEntity, 'id' | 'estado' | 'createdAt'>): Promise<ConsejeroEntity> {
    const [fila] = await this.db.insert(consejeros).values(input).returning()
    return fila!
  }

  async editar(
    id: string,
    cambios: Cambios<Omit<ConsejeroEntity, 'id' | 'createdAt'>>,
  ): Promise<void> {
    const limpios = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined))
    if (Object.keys(limpios).length === 0) return
    await this.db.update(consejeros).set(limpios).where(eq(consejeros.id, id))
  }

  async eliminar(id: string): Promise<void> {
    await this.db.delete(consejeros).where(eq(consejeros.id, id))
  }
}
