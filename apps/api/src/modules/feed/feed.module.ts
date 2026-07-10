import { Module } from '@nestjs/common'

/**
 * Bounded context `feed`: Tarjetas de Fe (video/imagen), likes, comentarios y follows.
 *
 * Se implementa en S3–S4 (ver docs/BACKLOG.md).
 * Capas: interface / application / domain / infrastructure.
 * Comunicación con otros módulos: solo por servicio público o evento de dominio.
 */
@Module({})
export class FeedModule {}
