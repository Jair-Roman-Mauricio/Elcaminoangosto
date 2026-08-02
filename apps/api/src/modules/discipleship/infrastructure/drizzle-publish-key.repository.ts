import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { publishKeys } from '../../shared/database/schema'
import { PublishKeyRepository, type PublishKeyEntity } from '../domain/publish-key.repository'

@Injectable()
export class DrizzlePublishKeyRepository extends PublishKeyRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async create(code: string, createdBy: string): Promise<PublishKeyEntity> {
    const [fila] = await this.db.insert(publishKeys).values({ code, createdBy }).returning()
    if (!fila) throw new NotFoundException('No se pudo crear la llave')
    return fila
  }

  async findByCode(code: string): Promise<PublishKeyEntity | null> {
    const filas = await this.db
      .select()
      .from(publishKeys)
      .where(eq(publishKeys.code, code))
      .limit(1)
    return filas[0] ?? null
  }

  async markUsed(id: string, usedBy: string, courseId: string): Promise<void> {
    await this.db
      .update(publishKeys)
      .set({ usedBy, usedCourseId: courseId, usedAt: new Date() })
      .where(eq(publishKeys.id, id))
  }

  async findAll(): Promise<PublishKeyEntity[]> {
    return this.db.select().from(publishKeys).orderBy(desc(publishKeys.createdAt))
  }
}
