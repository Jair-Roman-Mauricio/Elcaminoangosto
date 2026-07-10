import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { enrollments, lessonProgress, profiles } from '../../shared/database/schema'
import {
  EnrollmentRepository,
  type EnrollmentEntity,
  type StudentProgressRow,
} from '../domain/enrollment.repository'

@Injectable()
export class DrizzleEnrollmentRepository extends EnrollmentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<EnrollmentEntity | null> {
    const filas = await this.db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
      .limit(1)
    return filas[0] ? this.mapear(filas[0]) : null
  }

  async findWithProgress(enrollmentId: string) {
    const fila = await this.db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, enrollmentId))
      .limit(1)
    if (!fila[0]) return null

    const progreso = await this.db
      .select({ lessonId: lessonProgress.lessonId })
      .from(lessonProgress)
      .where(eq(lessonProgress.enrollmentId, enrollmentId))

    return {
      ...this.mapear(fila[0]),
      completedLessonIds: progreso.map((p) => p.lessonId),
    }
  }

  async findCourseIdsByStudent(studentId: string): Promise<string[]> {
    const filas = await this.db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(eq(enrollments.studentId, studentId))
    return filas.map((f) => f.courseId)
  }

  async create(studentId: string, courseId: string): Promise<EnrollmentEntity> {
    const [fila] = await this.db
      .insert(enrollments)
      .values({ studentId, courseId })
      // Idempotente: si ya existe, no falla y devuelve la fila.
      .onConflictDoUpdate({
        target: [enrollments.studentId, enrollments.courseId],
        set: { updatedAt: new Date() },
      })
      .returning()
    if (!fila) throw new NotFoundException('No se pudo crear la inscripción')
    return this.mapear(fila)
  }

  /**
   * Marca la lección completada y recalcula el progreso, en una transacción.
   *
   * El `insert` es idempotente por el índice único (enrollment, lesson): volver
   * a completar la misma lección no la cuenta dos veces. El `progress_pct` se
   * recalcula desde el recuento real de lecciones completadas, no incrementando,
   * para que sea consistente aunque se reintente.
   */
  async completeLesson(
    enrollmentId: string,
    lessonId: string,
    totalLessons: number,
  ): Promise<EnrollmentEntity> {
    return this.db.transaction(async (tx) => {
      await tx
        .insert(lessonProgress)
        .values({ enrollmentId, lessonId, completedAt: new Date() })
        .onConflictDoNothing({ target: [lessonProgress.enrollmentId, lessonProgress.lessonId] })

      const filas = await tx
        .select({ completadas: count() })
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.enrollmentId, enrollmentId),
            sql`${lessonProgress.completedAt} is not null`,
          ),
        )
      const completadas = filas[0]?.completadas ?? 0

      const pct = totalLessons > 0 ? Math.min(100, (completadas / totalLessons) * 100) : 0
      const completado = totalLessons > 0 && completadas >= totalLessons

      const [fila] = await tx
        .update(enrollments)
        .set({
          progressPct: pct.toFixed(2),
          status: completado ? 'COMPLETED' : 'ACTIVE',
          updatedAt: new Date(),
        })
        .where(eq(enrollments.id, enrollmentId))
        .returning()

      if (!fila) throw new NotFoundException('Inscripción no encontrada')
      return this.mapear(fila)
    })
  }

  async findRosterByCourse(courseId: string): Promise<StudentProgressRow[]> {
    const filas = await this.db
      .select({
        studentId: enrollments.studentId,
        studentName: profiles.displayName,
        progressPct: enrollments.progressPct,
        status: enrollments.status,
        lastActivityAt: sql<Date | null>`max(${lessonProgress.completedAt})`,
      })
      .from(enrollments)
      .innerJoin(profiles, eq(enrollments.studentId, profiles.id))
      .leftJoin(lessonProgress, eq(lessonProgress.enrollmentId, enrollments.id))
      .where(eq(enrollments.courseId, courseId))
      .groupBy(enrollments.studentId, profiles.displayName, enrollments.progressPct, enrollments.status)
      .orderBy(desc(enrollments.progressPct))

    return filas.map((f) => ({
      studentId: f.studentId,
      studentName: f.studentName,
      progressPct: Number(f.progressPct),
      status: f.status,
      lastActivityAt: f.lastActivityAt,
    }))
  }

  private mapear(fila: typeof enrollments.$inferSelect): EnrollmentEntity {
    return {
      id: fila.id,
      studentId: fila.studentId,
      courseId: fila.courseId,
      status: fila.status,
      progressPct: Number(fila.progressPct),
    }
  }
}
