import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { moderationActions, profiles } from '../../shared/database/schema'
import {
  ModerationActionRepository,
  type ModerationAction,
  type ModerationActionEntity,
} from '../domain/moderation-action.repository'

@Injectable()
export class DrizzleModerationActionRepository extends ModerationActionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async create(input: {
    courseId: string
    lessonId: string | null
    lessonTitle: string | null
    action: ModerationAction
    moderatorId: string
  }): Promise<ModerationActionEntity> {
    const [fila] = await this.db
      .insert(moderationActions)
      .values(input)
      .returning({ id: moderationActions.id })
    if (!fila) throw new NotFoundException('No se pudo registrar la decisión de moderación')
    const registrada = (await this.findByCourse(input.courseId)).find((a) => a.id === fila.id)
    if (!registrada) throw new NotFoundException('No se pudo registrar la decisión de moderación')
    return registrada
  }

  async findByCourse(courseId: string): Promise<ModerationActionEntity[]> {
    return this.db
      .select({
        id: moderationActions.id,
        courseId: moderationActions.courseId,
        lessonId: moderationActions.lessonId,
        lessonTitle: moderationActions.lessonTitle,
        action: moderationActions.action,
        moderatorId: moderationActions.moderatorId,
        moderatorName: profiles.displayName,
        createdAt: moderationActions.createdAt,
      })
      .from(moderationActions)
      .innerJoin(profiles, eq(moderationActions.moderatorId, profiles.id))
      .where(eq(moderationActions.courseId, courseId))
      .orderBy(desc(moderationActions.createdAt))
  }
}
