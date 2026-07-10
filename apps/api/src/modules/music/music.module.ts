import { Module } from '@nestjs/common'

/**
 * Bounded context `music`: catálogo, playlists, reproducciones y likes.
 *
 * Se implementa en S5 (ver docs/BACKLOG.md).
 * Capas: interface / application / domain / infrastructure.
 * Comunicación con otros módulos: solo por servicio público o evento de dominio.
 */
@Module({})
export class MusicModule {}
