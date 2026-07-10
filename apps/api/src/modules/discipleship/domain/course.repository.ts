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
}
