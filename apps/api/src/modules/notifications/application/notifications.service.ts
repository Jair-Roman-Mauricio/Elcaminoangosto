import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import {
  DOMAIN_EVENTS,
  type CourseSubmittedEvent,
  type CourseReviewedEvent,
} from '@elcamino/shared-types'
import { UsersService } from '../../users'
import {
  NotificationRepository,
  type NotificationEntity,
} from '../domain/notification.repository'

/**
 * Bounded context `notifications`. Reacciona a eventos de dominio de otros
 * módulos y crea notificaciones in-app. No conoce a esos módulos: solo escucha
 * sus eventos (y usa el servicio público de `users` para resolver a los admins).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly notifications: NotificationRepository,
    private readonly users: UsersService,
  ) {}

  async listar(userId: string): Promise<NotificationEntity[]> {
    return this.notifications.findByUser(userId)
  }

  async marcarLeida(userId: string, id: string): Promise<void> {
    await this.notifications.markRead(userId, id)
  }

  async contarNoLeidas(userId: string): Promise<number> {
    return this.notifications.countUnread(userId)
  }

  /** HU-5.1 — un curso enviado a revisión notifica a todos los admins. */
  @OnEvent(DOMAIN_EVENTS.COURSE_SUBMITTED)
  async alEnviarCurso(evento: CourseSubmittedEvent): Promise<void> {
    const admins = await this.users.idsDeAdmins()
    await Promise.all(
      admins.map((adminId) =>
        this.notifications.create(adminId, 'COURSE_SUBMITTED', {
          courseId: evento.courseId,
          teacherId: evento.teacherId,
        }),
      ),
    )
    this.logger.log(`Curso ${evento.courseId} enviado: ${admins.length} admin(s) notificados`)
  }

  /** HU-5.2 — la decisión del admin notifica al maestro. */
  @OnEvent(DOMAIN_EVENTS.COURSE_REVIEWED)
  async alRevisarCurso(evento: CourseReviewedEvent): Promise<void> {
    await this.notifications.create(evento.teacherId, 'COURSE_REVIEWED', {
      courseId: evento.courseId,
      decision: evento.decision,
    })
    this.logger.log(`Curso ${evento.courseId} ${evento.decision}: maestro notificado`)
  }
}
