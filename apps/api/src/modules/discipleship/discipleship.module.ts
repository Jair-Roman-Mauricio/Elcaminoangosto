import { Module } from '@nestjs/common'

/**
 * Bounded context `discipleship`: cursos, módulos, lecciones, inscripciones, progreso y flujo de aprobación.
 *
 * Se implementa en S1–S2 (ver docs/BACKLOG.md).
 * Capas: interface / application / domain / infrastructure.
 * Comunicación con otros módulos: solo por servicio público o evento de dominio.
 */
@Module({})
export class DiscipleshipModule {}
