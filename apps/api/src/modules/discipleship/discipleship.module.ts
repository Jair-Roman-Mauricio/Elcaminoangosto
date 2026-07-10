import { Module, type OnModuleInit } from '@nestjs/common'
import { DiscipleshipController } from './interface/discipleship.controller'
import { DiscipleshipService } from './application/discipleship.service'
import { CourseRepository } from './domain/course.repository'
import { EnrollmentRepository } from './domain/enrollment.repository'
import { DrizzleCourseRepository } from './infrastructure/drizzle-course.repository'
import { DrizzleEnrollmentRepository } from './infrastructure/drizzle-enrollment.repository'
import { PolicyRegistry } from '../shared'

/**
 * Bounded context `discipleship`: cursos, módulos, lecciones, inscripciones,
 * progreso y (en S2) el flujo de aprobación.
 *
 * Exporta SOLO `DiscipleshipService`. Registra el recurso `course` en el
 * `PolicyRegistry` para que `PolicyGuard` autorice sobre cursos sin importar
 * este repositorio (AGENTS.md §4).
 */
@Module({
  controllers: [DiscipleshipController],
  providers: [
    DiscipleshipService,
    { provide: CourseRepository, useClass: DrizzleCourseRepository },
    { provide: EnrollmentRepository, useClass: DrizzleEnrollmentRepository },
  ],
  exports: [DiscipleshipService],
})
export class DiscipleshipModule implements OnModuleInit {
  constructor(
    private readonly registry: PolicyRegistry,
    private readonly courses: CourseRepository,
  ) {}

  onModuleInit(): void {
    this.registry.register('course', async (id) => {
      const curso = await this.courses.findById(id)
      if (!curso) return null
      return { ownerId: curso.teacherId, requiredLevelRank: curso.requiredLevelRank }
    })
  }
}
