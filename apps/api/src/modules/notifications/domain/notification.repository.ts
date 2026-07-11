export interface NotificationEntity {
  id: string
  userId: string
  type: string
  payload: Record<string, unknown>
  readAt: Date | null
  createdAt: Date
}

export abstract class NotificationRepository {
  abstract create(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void>

  /** Notificaciones del usuario, de la más reciente a la más antigua. */
  abstract findByUser(userId: string): Promise<NotificationEntity[]>

  abstract markRead(userId: string, id: string): Promise<void>

  abstract countUnread(userId: string): Promise<number>
}
