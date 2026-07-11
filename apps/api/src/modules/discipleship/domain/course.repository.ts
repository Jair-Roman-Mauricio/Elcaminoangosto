import type { CourseStatus } from '@elcamino/shared-types'

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
  publishedAt: Date | null
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
  teacherName: string
  moduleCount: number
  lessonCount: number
}

export interface LessonEntity {
  id: string
  moduleId: string
  title: string
  type: 'VIDEO' | 'TEXT'
  content: string | null
  mediaAssetId: string | null
  orderIndex: number
  durationSeconds: number | null
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

  /** Estructura completa (módulos + lecciones ordenadas) de un curso. */
  abstract findStructure(courseId: string): Promise<CourseModuleEntity[]>

  abstract findLessonById(lessonId: string): Promise<LessonEntity | null>

  /** Sube de una lección a su curso (vía módulo) en una sola consulta. */
  abstract findCourseIdByLesson(lessonId: string): Promise<string | null>

  /** Nº total de lecciones del curso. Denominador del progreso. */
  abstract countLessons(courseId: string): Promise<number>

  // ── Autoría (HU-4.3) y ciclo de vida (E5) ────────────────────────────────

  /** Cursos de un maestro, en cualquier estado (para "Mis cursos"). */
  abstract findByTeacher(teacherId: string): Promise<CourseEntity[]>

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
    },
  ): Promise<CourseEntity>

  /** Cambia el estado. `publishedAt` se fija al pasar a PUBLISHED. */
  abstract setStatus(courseId: string, status: CourseStatus): Promise<CourseEntity>

  abstract addModule(courseId: string, title: string, orderIndex: number): Promise<string>

  abstract addLesson(input: {
    moduleId: string
    title: string
    type: 'VIDEO' | 'TEXT'
    content: string | null
    mediaAssetId: string | null
    orderIndex: number
    durationSeconds: number | null
  }): Promise<string>

  /** ¿El curso tiene al menos una lección? (requisito para enviar a revisión). */
  abstract hasAnyLesson(courseId: string): Promise<boolean>

  /** ¿El slug ya existe? Para generar uno único al crear. */
  abstract slugExists(slug: string): Promise<boolean>
}
