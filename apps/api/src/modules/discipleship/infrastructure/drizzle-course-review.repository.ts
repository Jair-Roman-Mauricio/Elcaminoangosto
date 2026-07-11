import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { courseReviews, profiles } from '../../shared/database/schema'
import {
  CourseReviewRepository,
  type CourseReviewEntity,
} from '../domain/course-review.repository'

@Injectable()
export class DrizzleCourseReviewRepository extends CourseReviewRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async create(input: {
    courseId: string
    reviewerId: string
    decision: 'APPROVED' | 'REJECTED'
    notes: string | null
  }): Promise<CourseReviewEntity> {
    const [fila] = await this.db
      .insert(courseReviews)
      .values(input)
      .returning({ id: courseReviews.id })
    if (!fila) throw new NotFoundException('No se pudo registrar la revisión')
    const filas = await this.findByCourse(input.courseId)
    const creada = filas.find((r) => r.id === fila.id)
    if (!creada) throw new NotFoundException('No se pudo registrar la revisión')
    return creada
  }

  async findByCourse(courseId: string): Promise<CourseReviewEntity[]> {
    const filas = await this.db
      .select({
        id: courseReviews.id,
        courseId: courseReviews.courseId,
        reviewerId: courseReviews.reviewerId,
        reviewerName: profiles.displayName,
        decision: courseReviews.decision,
        notes: courseReviews.notes,
        reviewedAt: courseReviews.reviewedAt,
      })
      .from(courseReviews)
      .innerJoin(profiles, eq(courseReviews.reviewerId, profiles.id))
      .where(eq(courseReviews.courseId, courseId))
      .orderBy(desc(courseReviews.reviewedAt))
    return filas
  }
}
