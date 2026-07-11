import { Module } from '@nestjs/common'
import { NotificationsController } from './interface/notifications.controller'
import { NotificationsService } from './application/notifications.service'
import { NotificationRepository } from './domain/notification.repository'
import { DrizzleNotificationRepository } from './infrastructure/drizzle-notification.repository'
import { UsersModule } from '../users'

/**
 * Bounded context `notifications`. Escucha eventos de dominio de otros módulos
 * (via EventEmitter2) y crea notificaciones in-app. Usa el servicio público de
 * `users` para resolver a los administradores; no importa ningún repositorio ajeno.
 */
@Module({
  imports: [UsersModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: NotificationRepository, useClass: DrizzleNotificationRepository },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
