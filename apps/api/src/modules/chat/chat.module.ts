import { Module } from '@nestjs/common'

/**
 * Bounded context `chat`: conversaciones mentor–estudiante y solicitudes de subida de nivel.
 *
 * Se implementa en S4 (ver docs/BACKLOG.md).
 * Capas: interface / application / domain / infrastructure.
 * Comunicación con otros módulos: solo por servicio público o evento de dominio.
 */
@Module({})
export class ChatModule {}
