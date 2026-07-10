import { Module } from '@nestjs/common'

/**
 * Bounded context `admin`: aprobación de cursos, gestión de usuarios/roles y moderación.
 *
 * Se implementa en S2 y S6 (ver docs/BACKLOG.md).
 * Capas: interface / application / domain / infrastructure.
 * Comunicación con otros módulos: solo por servicio público o evento de dominio.
 */
@Module({})
export class AdminModule {}
