import type { CourseStatus, LessonType, PreguntaExamen } from '@elcamino/shared-types'

/** Entidades de dominio. TypeScript puro: sin Nest, sin Drizzle. */

export interface CourseEntity {
  id: string
  teacherId: string
  title: string
  slug: string
  description: string | null
  thumbnailAssetId: string | null
  requiredLevelId: string | null
  /** `rank` del nivel requerido. `null` = curso abierto. */
  requiredLevelRank: number | null
  isFree: boolean
  status: CourseStatus
  plannedModules: number
  /** «Lo que aprenderás»: objetivos que redacta el maestro. */
  learningObjectives: string[]
  /** «Propósito» del curso (texto libre del maestro). */
  purpose: string | null
  /** URL de la imagen de portada. */
  coverImageUrl: string | null
  publishedAt: Date | null
  /** Bloqueado por moderación → inaccesible a estudiantes (HU-7.2). */
  blocked: boolean
}

export interface CourseCardEntity {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailAssetId: string | null
  requiredLevelId: string | null
  requiredLevelRank: number | null
  isFree: boolean
  coverImageUrl: string | null
  teacherName: string
  moduleCount: number
  lessonCount: number
}

export type ModerationStatus = 'APPROVED' | 'PENDING' | 'BLOCKED'

export interface LessonEntity {
  id: string
  moduleId: string
  title: string
  type: LessonType
  content: string | null
  mediaAssetId: string | null
  /** Preguntas de la evaluación (solo lecciones EXAM). */
  questions: PreguntaExamen[]
  orderIndex: number
  durationSeconds: number | null
  /** Estado de moderación del contenido (HU-7.2). */
  moderationStatus: ModerationStatus
}

/** Un curso publicado con contenido pendiente/bloqueado, para la cola de moderación. */
export interface ModerationCourseStat {
  id: string
  title: string
  slug: string
  blocked: boolean
  pendientes: number
  bloqueados: number
}

export interface CourseModuleEntity {
  id: string
  title: string
  orderIndex: number
  lessons: LessonEntity[]
}

export interface CatalogFilter {
  /** Nivel del estudiante que consulta. Solo se listan cursos ≤ este rank. */
  studentLevelRank: number
}

/** Inscritos y cuántos completaron un curso (para estadísticas del maestro). */
export interface CourseCompletionStat {
  courseId: string
  title: string
  enrolled: number
  completed: number
}

/** Tipo de recurso sobre el que el admin deja una indicación de cambio. */
export type ObservationResource =
  | 'LESSON'
  | 'MODULE'
  | 'DESCRIPTION'
  | 'PURPOSE'
  | 'OBJECTIVES'
  | 'COVER'
  | 'COURSE'

/** Indicación de cambio del admin sobre un recurso concreto de un curso. */
export interface ObservationEntity {
  id: string
  courseId: string
  resourceType: ObservationResource
  resourceId: string | null
  note: string
  createdBy: string
  resolvedAt: Date | null
  createdAt: Date
}

/**
 * Puerto del repositorio de cursos. La implementación (adaptador Drizzle) vive
 * en `infrastructure/`. El dominio depende de esta interfaz, nunca al revés.
 */
export abstract class CourseRepository {
  /** Catálogo del estudiante: solo cursos PUBLISHED de su nivel o inferior (HU-4.1). */
  abstract findPublishedForLevel(filter: CatalogFilter): Promise<CourseCardEntity[]>

  /** Todos los cursos PUBLISHED, con su rank requerido — para marcar los bloqueados. */
  abstract findAllPublished(): Promise<CourseCardEntity[]>

  abstract findById(id: string): Promise<CourseEntity | null>
  abstract findBySlug(slug: string): Promise<CourseEntity | null>

  /**
   * Estructura completa (módulos + lecciones ordenadas) de un curso.
   * `soloAprobadas` limita a contenido visible para el estudiante (HU-7.2).
   */
  abstract findStructure(
    courseId: string,
    opts?: { soloAprobadas?: boolean },
  ): Promise<CourseModuleEntity[]>

  abstract findLessonById(lessonId: string): Promise<LessonEntity | null>

  /** Sube de una lección a su curso (vía módulo) en una sola consulta. */
  abstract findCourseIdByLesson(lessonId: string): Promise<string | null>

  /**
   * Nº de lecciones del curso. `soloAprobadas` limita al contenido visible para
   * el estudiante (HU-7.2): es el denominador correcto del progreso, porque lo
   * pendiente o bloqueado no se le puede exigir completar.
   */
  abstract countLessons(courseId: string, opts?: { soloAprobadas?: boolean }): Promise<number>

  // ── Autoría (HU-4.3) y ciclo de vida (E5) ────────────────────────────────

  /** Cursos de un maestro, en cualquier estado (para "Mis cursos"). */
  abstract findByTeacher(teacherId: string): Promise<CourseEntity[]>

  /** Por cada curso del maestro: inscritos y cuántos lo completaron (HU-1.3). */
  abstract completionStatsByTeacher(teacherId: string): Promise<CourseCompletionStat[]>

  // ── Indicaciones de revisión (HU-5.2) ────────────────────────────────────
  abstract createObservation(input: {
    courseId: string
    resourceType: ObservationResource
    resourceId: string | null
    note: string
    createdBy: string
  }): Promise<ObservationEntity>
  abstract listObservations(courseId: string): Promise<ObservationEntity[]>
  abstract deleteObservation(id: string): Promise<void>
  abstract findObservationById(id: string): Promise<ObservationEntity | null>

  /** Todos los cursos en un estado dado (cola de revisión del admin). */
  abstract findByStatus(status: CourseStatus): Promise<CourseEntity[]>

  abstract createDraft(input: {
    teacherId: string
    title: string
    slug: string
    description: string | null
    requiredLevelId: string | null
    isFree: boolean
    plannedModules: number
  }): Promise<CourseEntity>

  abstract updateDraft(
    courseId: string,
    changes: {
      title?: string | undefined
      description?: string | null | undefined
      requiredLevelId?: string | null | undefined
      isFree?: boolean | undefined
      plannedModules?: number | undefined
      learningObjectives?: string[] | undefined
      purpose?: string | null | undefined
      coverImageUrl?: string | null | undefined
    },
  ): Promise<CourseEntity>

  /** Cambia el estado. `publishedAt` se fija al pasar a PUBLISHED. */
  abstract setStatus(courseId: string, status: CourseStatus): Promise<CourseEntity>

  abstract addModule(courseId: string, title: string, orderIndex: number): Promise<string>

  abstract addLesson(input: {
    moduleId: string
    title: string
    type: LessonType
    content: string | null
    mediaAssetId: string | null
    questions: PreguntaExamen[]
    orderIndex: number
    durationSeconds: number | null
    moderationStatus?: ModerationStatus
  }): Promise<string>

  // ── Moderación de cursos publicados (HU-7.2) ──────────────────────────────
  /** Cursos publicados con conteo de contenido pendiente/bloqueado. */
  abstract moderationQueue(): Promise<ModerationCourseStat[]>
  /** Cambia el estado de moderación de una lección. */
  abstract setLessonModeration(lessonId: string, status: ModerationStatus): Promise<void>
  /** Bloquea/desbloquea un curso por completo (inaccesible a estudiantes). */
  abstract setCourseBlocked(courseId: string, blocked: boolean): Promise<void>

  /** Borra una lección (sus recursos caen por FK en cascada). */
  abstract deleteLesson(lessonId: string): Promise<void>

  /** ¿El curso tiene al menos una lección? (requisito para enviar a revisión). */
  abstract hasAnyLesson(courseId: string): Promise<boolean>

  /** ¿El slug ya existe? Para generar uno único al crear. */
  abstract slugExists(slug: string): Promise<boolean>
}
