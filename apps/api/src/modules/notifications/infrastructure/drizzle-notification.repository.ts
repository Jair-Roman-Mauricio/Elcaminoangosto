import { Inject, Injectable } from '@nestjs/common'
import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { notifications } from '../../shared/database/schema'
import {
  NotificationRepository,
  type NotificationEntity,
} from '../domain/notification.repository'

@Injectable()
export class DrizzleNotificationRepository extends NotificationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async create(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(notifications).values({ userId, type, payload })
  }

  async findByUser(userId: string): Promise<NotificationEntity[]> {
    const filas = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
    return filas.map((f) => ({
      id: f.id,
      userId: f.userId,
      type: f.type,
      payload: f.payload as Record<string, unknown>,
      readAt: f.readAt,
      createdAt: f.createdAt,
    }))
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
  }

  async countUnread(userId: string): Promise<number> {
    const filas = await this.db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    return filas[0]?.n ?? 0
  }
}
