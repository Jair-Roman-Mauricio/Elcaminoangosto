import { Module } from '@nestjs/common'

/**
 * Bounded context `notifications`: notificaciones in-app y email.
 *
 * Se implementa en S2 (ver docs/BACKLOG.md).
 * Capas: interface / application / domain / infrastructure.
 * Comunicación con otros módulos: solo por servicio público o evento de dominio.
 */
@Module({})
export class NotificationsModule {}
