import { Module } from '@nestjs/common'

/**
 * Bounded context `media`: ingesta, subida reanudable, transcodificación y URLs firmadas.
 *
 * Se implementa en S3 (ver docs/BACKLOG.md).
 * Capas: interface / application / domain / infrastructure.
 * Comunicación con otros módulos: solo por servicio público o evento de dominio.
 */
@Module({})
export class MediaModule {}
