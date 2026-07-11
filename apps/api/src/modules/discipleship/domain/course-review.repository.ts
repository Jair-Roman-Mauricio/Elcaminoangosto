export interface CourseReviewEntity {
  id: string
  courseId: string
  reviewerId: string
  reviewerName: string
  decision: 'APPROVED' | 'REJECTED'
  notes: string | null
  reviewedAt: Date
}

/**
 * Auditoría del flujo de aprobación (HU-5.2). Cada decisión del admin queda
 * registrada, sin borrado: es un historial.
 */
export abstract class CourseReviewRepository {
  abstract create(input: {
    courseId: string
    reviewerId: string
    decision: 'APPROVED' | 'REJECTED'
    notes: string | null
  }): Promise<CourseReviewEntity>

  /** Historial de decisiones de un curso, de la más reciente a la más antigua. */
  abstract findByCourse(courseId: string): Promise<CourseReviewEntity[]>
}
