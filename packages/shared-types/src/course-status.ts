import { z } from 'zod'

/**
 * Máquina de estados de publicación de un curso (contexto.md §5).
 *
 *   DRAFT ──(maestro envía)──► SUBMITTED ──(admin toma)──► UNDER_REVIEW
 *                                                            │
 *                          ┌─────────────────────────────────┤
 *                          ▼                                 ▼
 *                      REJECTED ──(maestro corrige)──►   APPROVED ──► PUBLISHED
 *                                    (vuelve a DRAFT)                     │
 *                                                          ARCHIVED ◄─────┘
 *
 * INVARIANTE INVIOLABLE: un curso de MAESTRO nunca se autopublica.
 * No existe transición DRAFT → PUBLISHED.
 */
export const CourseStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
])
export type CourseStatus = z.infer<typeof CourseStatusSchema>

/** Transiciones válidas. La clave es el estado de origen. */
export const COURSE_TRANSITIONS: Readonly<Record<CourseStatus, readonly CourseStatus[]>> =
  Object.freeze({
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED: ['PUBLISHED', 'ARCHIVED'],
    PUBLISHED: ['ARCHIVED'],
    REJECTED: ['DRAFT'],
    ARCHIVED: [],
  })

export function canTransition(from: CourseStatus, to: CourseStatus): boolean {
  return COURSE_TRANSITIONS[from].includes(to)
}

/** Estados en los que el maestro puede editar la estructura crítica (HU-5.1). */
export function isEditableByTeacher(status: CourseStatus): boolean {
  return status === 'DRAFT'
}

/** Estados visibles en el catálogo del estudiante. */
export function isVisibleToStudents(status: CourseStatus): boolean {
  return status === 'PUBLISHED'
}
