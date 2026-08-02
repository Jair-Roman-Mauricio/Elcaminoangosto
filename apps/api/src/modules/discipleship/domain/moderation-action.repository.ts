/**
 * Bitácora de moderación (HU-7.2): registro de auditoría de las decisiones del
 * admin sobre cursos ya publicados. Se escribe, se lee; nunca se modifica.
 */
export type ModerationAction =
  'LESSON_APPROVED' | 'LESSON_PENDING' | 'LESSON_BLOCKED' | 'COURSE_BLOCKED' | 'COURSE_UNBLOCKED'

export interface ModerationActionEntity {
  id: string
  courseId: string
  /** Lección afectada; nulo cuando la decisión es sobre el curso completo. */
  lessonId: string | null
  /** Título que tenía la lección al decidirse (sobrevive a su borrado). */
  lessonTitle: string | null
  action: ModerationAction
  moderatorId: string
  moderatorName: string
  createdAt: Date
}

/** Puerto del repositorio de la bitácora de moderación. */
export abstract class ModerationActionRepository {
  abstract create(input: {
    courseId: string
    lessonId: string | null
    lessonTitle: string | null
    action: ModerationAction
    moderatorId: string
  }): Promise<ModerationActionEntity>

  /** Decisiones de un curso, más recientes primero. */
  abstract findByCourse(courseId: string): Promise<ModerationActionEntity[]>
}
