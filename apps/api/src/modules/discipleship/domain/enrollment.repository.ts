import type { EnrollmentStatus } from '@elcamino/shared-types'

export interface EnrollmentEntity {
  id: string
  studentId: string
  courseId: string
  status: EnrollmentStatus
  progressPct: number
}

export interface EnrollmentWithProgress extends EnrollmentEntity {
  /** Ids de las lecciones ya completadas. */
  completedLessonIds: string[]
}

/** Vista del maestro sobre un inscrito (HU-4.5). */
export interface StudentProgressRow {
  studentId: string
  studentName: string
  progressPct: number
  status: EnrollmentStatus
  lastActivityAt: Date | null
}

export abstract class EnrollmentRepository {
  abstract findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<EnrollmentEntity | null>

  abstract findWithProgress(enrollmentId: string): Promise<EnrollmentWithProgress | null>

  /** Todas las inscripciones del estudiante, para pintar el catálogo. */
  abstract findCourseIdsByStudent(studentId: string): Promise<string[]>

  abstract create(studentId: string, courseId: string): Promise<EnrollmentEntity>

  /** Marca una lección como completada (idempotente) y devuelve el progreso nuevo. */
  abstract completeLesson(
    enrollmentId: string,
    lessonId: string,
    totalLessons: number,
  ): Promise<EnrollmentEntity>

  /** Inscritos de un curso con su progreso — para el maestro dueño (HU-4.5). */
  abstract findRosterByCourse(courseId: string): Promise<StudentProgressRow[]>
}
