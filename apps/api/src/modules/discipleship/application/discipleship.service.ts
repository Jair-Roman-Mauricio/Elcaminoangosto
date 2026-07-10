import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DOMAIN_EVENTS, type LessonCompletedEvent } from '@elcamino/shared-types'
import { cumpleNivel, motivoDeBloqueo, type Actor } from '../../shared'
import { CourseRepository, type CourseModuleEntity } from '../domain/course.repository'
import {
  EnrollmentRepository,
  type EnrollmentEntity,
  type StudentProgressRow,
} from '../domain/enrollment.repository'

/** Tarjeta de catálogo con el veredicto de acceso ya resuelto (HU-4.1). */
export interface CatalogItem {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailAssetId: string | null
  requiredLevelRank: number | null
  isFree: boolean
  teacherName: string
  moduleCount: number
  lessonCount: number
  /** `true` si el estudiante cumple el nivel. */
  unlocked: boolean
  enrolled: boolean
  /** Motivo del bloqueo, o `null` si tiene acceso. */
  lockedReason: string | null
}

/**
 * API pública del bounded context `discipleship`.
 * Único punto por el que otros módulos piden datos de cursos.
 */
@Injectable()
export class DiscipleshipService {
  constructor(
    private readonly courses: CourseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Catálogo del estudiante (HU-4.1). Devuelve TODOS los cursos publicados;
   * los de nivel superior llegan marcados `unlocked:false` con su motivo, para
   * que el front los muestre bloqueados en vez de ocultarlos.
   */
  async catalogo(actor: Actor): Promise<CatalogItem[]> {
    const [publicados, inscritos] = await Promise.all([
      this.courses.findAllPublished(),
      this.enrollments.findCourseIdsByStudent(actor.id),
    ])
    const inscritoEn = new Set(inscritos)

    return publicados.map((c) => {
      const recurso = { requiredLevelRank: c.requiredLevelRank }
      const unlocked = cumpleNivel(actor, recurso)
      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        thumbnailAssetId: c.thumbnailAssetId,
        requiredLevelRank: c.requiredLevelRank,
        isFree: c.isFree,
        teacherName: c.teacherName,
        moduleCount: c.moduleCount,
        lessonCount: c.lessonCount,
        unlocked,
        enrolled: inscritoEn.has(c.id),
        lockedReason: unlocked
          ? null
          : `Requiere el nivel ${c.requiredLevelRank}. Tu nivel actual es ${actor.levelRank}.`,
      }
    })
  }

  /** Ficha de un curso por slug, con su estructura y las lecciones completadas. */
  async fichaPorSlug(
    actor: Actor,
    slug: string,
  ): Promise<{
    id: string
    title: string
    description: string | null
    requiredLevelRank: number | null
    isFree: boolean
    unlocked: boolean
    enrolled: boolean
    progressPct: number
    completedLessonIds: string[]
    modules: CourseModuleEntity[]
  }> {
    const curso = await this.courses.findBySlug(slug)
    if (!curso || curso.status !== 'PUBLISHED') {
      throw new NotFoundException('Curso no encontrado')
    }

    const unlocked = cumpleNivel(actor, { requiredLevelRank: curso.requiredLevelRank })
    const enrollment = await this.enrollments.findByStudentAndCourse(actor.id, curso.id)

    // Las lecciones completadas solo tienen sentido si hay inscripción.
    const progreso = enrollment
      ? await this.enrollments.findWithProgress(enrollment.id)
      : null

    return {
      id: curso.id,
      title: curso.title,
      description: curso.description,
      requiredLevelRank: curso.requiredLevelRank,
      isFree: curso.isFree,
      unlocked,
      enrolled: enrollment !== null,
      progressPct: enrollment?.progressPct ?? 0,
      completedLessonIds: progreso?.completedLessonIds ?? [],
      modules: await this.courses.findStructure(curso.id),
    }
  }

  /**
   * Inscripción (HU-4.1). Valida que el curso esté publicado y que el estudiante
   * cumpla el nivel; si no, 403 con motivo claro. Idempotente: si ya está
   * inscrito, devuelve la inscripción existente.
   */
  async inscribirse(actor: Actor, courseId: string): Promise<EnrollmentEntity> {
    const curso = await this.courses.findById(courseId)
    if (!curso || curso.status !== 'PUBLISHED') {
      throw new NotFoundException('Curso no encontrado')
    }

    const yaInscrito = await this.enrollments.findByStudentAndCourse(actor.id, courseId)
    if (yaInscrito) return yaInscrito

    const motivo = motivoDeBloqueo(actor, {
      ownerId: curso.teacherId,
      requiredLevelRank: curso.requiredLevelRank,
    })
    if (motivo) throw new ForbiddenException(motivo)

    return this.enrollments.create(actor.id, courseId)
  }

  /**
   * Marca una lección como completada (HU-4.2). Solo el estudiante inscrito
   * puede hacerlo. Recalcula el `progress_pct` y emite `LessonCompleted`.
   */
  async completarLeccion(
    actor: Actor,
    lessonId: string,
  ): Promise<{ progressPct: number; courseCompleted: boolean }> {
    const enrollment = await this.enrollmentDeLaLeccion(actor.id, lessonId)
    const total = await this.courses.countLessons(enrollment.courseId)

    const actualizado = await this.enrollments.completeLesson(enrollment.id, lessonId, total)

    const evento: LessonCompletedEvent = {
      enrollmentId: enrollment.id,
      lessonId,
      studentId: actor.id,
    }
    this.events.emit(DOMAIN_EVENTS.LESSON_COMPLETED, evento)

    return {
      progressPct: actualizado.progressPct,
      courseCompleted: actualizado.status === 'COMPLETED',
    }
  }

  /**
   * ¿Puede este actor ver el medio privado de esta lección? (HU-4.2, HU-8.3).
   * Devuelve el `mediaAssetId` a firmar, o lanza 403.
   */
  async autorizarMedioDeLeccion(actor: Actor, lessonId: string): Promise<string> {
    const leccion = await this.courses.findLessonById(lessonId)
    if (!leccion) throw new NotFoundException('Lección no encontrada')
    if (!leccion.mediaAssetId) throw new NotFoundException('La lección no tiene medio')

    // El admin no necesita inscripción; el resto sí.
    if (actor.role === 'ADMIN') return leccion.mediaAssetId

    await this.enrollmentDeLaLeccion(actor.id, lessonId)
    return leccion.mediaAssetId
  }

  /** Roster de un curso para su maestro dueño (HU-4.5). */
  async rosterDeCurso(actor: Actor, courseId: string): Promise<StudentProgressRow[]> {
    const curso = await this.courses.findById(courseId)
    if (!curso) throw new NotFoundException('Curso no encontrado')
    if (actor.role !== 'ADMIN' && curso.teacherId !== actor.id) {
      throw new ForbiddenException('Solo el maestro del curso ve a sus estudiantes')
    }
    return this.enrollments.findRosterByCourse(courseId)
  }

  /**
   * Localiza la inscripción del estudiante para la lección, o lanza 403.
   * Devuelve también el `courseId` para no volver a resolverlo.
   */
  private async enrollmentDeLaLeccion(
    studentId: string,
    lessonId: string,
  ): Promise<EnrollmentEntity & { courseId: string }> {
    const courseId = await this.courses.findCourseIdByLesson(lessonId)
    if (!courseId) throw new NotFoundException('Curso de la lección no encontrado')

    const enrollment = await this.enrollments.findByStudentAndCourse(studentId, courseId)
    if (!enrollment) {
      throw new ForbiddenException('Debes inscribirte en el curso para acceder a esta lección')
    }
    return { ...enrollment, courseId }
  }
}
