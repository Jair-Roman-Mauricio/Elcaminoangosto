import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, count, eq, sql, type SQL } from 'drizzle-orm'
import type { CourseStatus, LessonType, PreguntaExamen } from '@elcamino/shared-types'
import { DRIZZLE, type Database } from '../../shared'
import {
  courses,
  courseModules,
  lessons,
  levels,
  profiles,
  enrollments,
  contentObservations,
} from '../../shared/database/schema'
import {
  CourseRepository,
  type CourseCardEntity,
  type CourseCompletionStat,
  type CourseEntity,
  type CourseModuleEntity,
  type LessonEntity,
  type ModerationCourseStat,
  type ModerationStatus,
  type ObservationEntity,
  type ObservationResource,
} from '../domain/course.repository'

/** Adaptador Drizzle del puerto `CourseRepository`. */
@Injectable()
export class DrizzleCourseRepository extends CourseRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async findAllPublished(): Promise<CourseCardEntity[]> {
    const filas = await this.db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        description: courses.description,
        thumbnailAssetId: courses.thumbnailAssetId,
        requiredLevelId: courses.requiredLevelId,
        requiredLevelRank: levels.rank,
        isFree: courses.isFree,
        coverImageUrl: courses.coverImageUrl,
        teacherName: profiles.displayName,
        moduleCount: sql<number>`count(distinct ${courseModules.id})`.mapWith(Number),
        lessonCount: sql<number>`count(distinct ${lessons.id})`.mapWith(Number),
      })
      .from(courses)
      .innerJoin(profiles, eq(courses.teacherId, profiles.id))
      .leftJoin(levels, eq(courses.requiredLevelId, levels.id))
      .leftJoin(courseModules, eq(courseModules.courseId, courses.id))
      .leftJoin(lessons, eq(lessons.moduleId, courseModules.id))
      // Los cursos bloqueados por moderación no aparecen en el catálogo (HU-7.2).
      .where(and(eq(courses.status, 'PUBLISHED'), eq(courses.blocked, false)))
      .groupBy(courses.id, levels.rank, profiles.displayName)
      .orderBy(asc(levels.rank), asc(courses.title))

    return filas.map((f) => ({ ...f, requiredLevelRank: f.requiredLevelRank ?? null }))
  }

  async findPublishedForLevel(filter: {
    studentLevelRank: number
  }): Promise<CourseCardEntity[]> {
    const todos = await this.findAllPublished()
    return todos.filter(
      (c) => c.requiredLevelRank === null || c.requiredLevelRank <= filter.studentLevelRank,
    )
  }

  async findById(id: string): Promise<CourseEntity | null> {
    return this.findOne(eq(courses.id, id))
  }

  async findBySlug(slug: string): Promise<CourseEntity | null> {
    return this.findOne(eq(courses.slug, slug))
  }

  private async findOne(where: SQL): Promise<CourseEntity | null> {
    const filas = await this.db
      .select({
        id: courses.id,
        teacherId: courses.teacherId,
        title: courses.title,
        slug: courses.slug,
        description: courses.description,
        thumbnailAssetId: courses.thumbnailAssetId,
        requiredLevelId: courses.requiredLevelId,
        requiredLevelRank: levels.rank,
        isFree: courses.isFree,
        status: courses.status,
        plannedModules: courses.plannedModules,
        learningObjectives: courses.learningObjectives,
        purpose: courses.purpose,
        coverImageUrl: courses.coverImageUrl,
        publishedAt: courses.publishedAt,
        blocked: courses.blocked,
      })
      .from(courses)
      .leftJoin(levels, eq(courses.requiredLevelId, levels.id))
      .where(where)
      .limit(1)

    const f = filas[0]
    if (!f) return null
    return { ...f, requiredLevelRank: f.requiredLevelRank ?? null }
  }

  async findStructure(
    courseId: string,
    opts?: { soloAprobadas?: boolean },
  ): Promise<CourseModuleEntity[]> {
    const modulos = await this.db
      .select({ id: courseModules.id, title: courseModules.title, orderIndex: courseModules.orderIndex })
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId))
      .orderBy(asc(courseModules.orderIndex))

    if (modulos.length === 0) return []

    const filtro = opts?.soloAprobadas
      ? and(eq(courseModules.courseId, courseId), eq(lessons.moderationStatus, 'APPROVED'))
      : eq(courseModules.courseId, courseId)

    const todasLasLecciones = await this.db
      .select({
        id: lessons.id,
        moduleId: lessons.moduleId,
        title: lessons.title,
        type: lessons.type,
        content: lessons.content,
        mediaAssetId: lessons.mediaAssetId,
        questions: lessons.questions,
        orderIndex: lessons.orderIndex,
        durationSeconds: lessons.durationSeconds,
        moderationStatus: lessons.moderationStatus,
      })
      .from(lessons)
      .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
      .where(filtro)
      .orderBy(asc(lessons.orderIndex))

    return modulos.map((m) => ({
      ...m,
      lessons: todasLasLecciones.filter((l) => l.moduleId === m.id),
    }))
  }

  async findLessonById(lessonId: string): Promise<LessonEntity | null> {
    const filas = await this.db
      .select({
        id: lessons.id,
        moduleId: lessons.moduleId,
        title: lessons.title,
        type: lessons.type,
        content: lessons.content,
        mediaAssetId: lessons.mediaAssetId,
        questions: lessons.questions,
        orderIndex: lessons.orderIndex,
        durationSeconds: lessons.durationSeconds,
        moderationStatus: lessons.moderationStatus,
      })
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1)
    return filas[0] ?? null
  }

  async findCourseIdByLesson(lessonId: string): Promise<string | null> {
    const filas = await this.db
      .select({ courseId: courseModules.courseId })
      .from(lessons)
      .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
      .where(eq(lessons.id, lessonId))
      .limit(1)
    return filas[0]?.courseId ?? null
  }

  async countLessons(courseId: string, opts?: { soloAprobadas?: boolean }): Promise<number> {
    const filas = await this.db
      .select({ n: count() })
      .from(lessons)
      .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
      .where(
        opts?.soloAprobadas
          ? and(eq(courseModules.courseId, courseId), eq(lessons.moderationStatus, 'APPROVED'))
          : eq(courseModules.courseId, courseId),
      )
    return filas[0]?.n ?? 0
  }

  // ── Autoría y ciclo de vida ────────────────────────────────────────────────

  async findByTeacher(teacherId: string): Promise<CourseEntity[]> {
    return this.findMany(eq(courses.teacherId, teacherId))
  }

  async findByStatus(status: CourseStatus): Promise<CourseEntity[]> {
    return this.findMany(eq(courses.status, status))
  }

  async completionStatsByTeacher(teacherId: string): Promise<CourseCompletionStat[]> {
    const filas = await this.db
      .select({
        courseId: courses.id,
        title: courses.title,
        enrolled: count(enrollments.id),
        completed: sql<number>`count(*) filter (where ${enrollments.status} = 'COMPLETED')`.mapWith(
          Number,
        ),
      })
      .from(courses)
      .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
      .where(eq(courses.teacherId, teacherId))
      .groupBy(courses.id, courses.title)
      .orderBy(asc(courses.title))
    return filas.map((f) => ({ ...f, enrolled: Number(f.enrolled), completed: Number(f.completed) }))
  }

  private mapObservacion(f: typeof contentObservations.$inferSelect): ObservationEntity {
    return {
      id: f.id,
      courseId: f.courseId,
      resourceType: f.resourceType as ObservationResource,
      resourceId: f.resourceId,
      note: f.note,
      createdBy: f.createdBy,
      resolvedAt: f.resolvedAt,
      createdAt: f.createdAt,
    }
  }

  async createObservation(input: {
    courseId: string
    resourceType: ObservationResource
    resourceId: string | null
    note: string
    createdBy: string
  }): Promise<ObservationEntity> {
    const [fila] = await this.db.insert(contentObservations).values(input).returning()
    if (!fila) throw new NotFoundException('No se pudo crear la indicación')
    return this.mapObservacion(fila)
  }

  async listObservations(courseId: string): Promise<ObservationEntity[]> {
    const filas = await this.db
      .select()
      .from(contentObservations)
      .where(eq(contentObservations.courseId, courseId))
      .orderBy(asc(contentObservations.createdAt))
    return filas.map((f) => this.mapObservacion(f))
  }

  async findObservationById(id: string): Promise<ObservationEntity | null> {
    const [fila] = await this.db
      .select()
      .from(contentObservations)
      .where(eq(contentObservations.id, id))
      .limit(1)
    return fila ? this.mapObservacion(fila) : null
  }

  async deleteObservation(id: string): Promise<void> {
    await this.db.delete(contentObservations).where(eq(contentObservations.id, id))
  }

  private async findMany(where: SQL): Promise<CourseEntity[]> {
    const filas = await this.db
      .select({
        id: courses.id,
        teacherId: courses.teacherId,
        title: courses.title,
        slug: courses.slug,
        description: courses.description,
        thumbnailAssetId: courses.thumbnailAssetId,
        requiredLevelId: courses.requiredLevelId,
        requiredLevelRank: levels.rank,
        isFree: courses.isFree,
        status: courses.status,
        plannedModules: courses.plannedModules,
        learningObjectives: courses.learningObjectives,
        purpose: courses.purpose,
        coverImageUrl: courses.coverImageUrl,
        publishedAt: courses.publishedAt,
        blocked: courses.blocked,
      })
      .from(courses)
      .leftJoin(levels, eq(courses.requiredLevelId, levels.id))
      .where(where)
      .orderBy(asc(courses.updatedAt))
    return filas.map((f) => ({ ...f, requiredLevelRank: f.requiredLevelRank ?? null }))
  }

  async createDraft(input: {
    teacherId: string
    title: string
    slug: string
    description: string | null
    requiredLevelId: string | null
    isFree: boolean
    plannedModules: number
  }): Promise<CourseEntity> {
    const [fila] = await this.db
      .insert(courses)
      .values({ ...input, status: 'DRAFT' })
      .returning({ id: courses.id })
    if (!fila) throw new NotFoundException('No se pudo crear el curso')
    const curso = await this.findById(fila.id)
    if (!curso) throw new NotFoundException('No se pudo crear el curso')
    return curso
  }

  async updateDraft(
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
  ): Promise<CourseEntity> {
    await this.db
      .update(courses)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(courses.id, courseId))
    return this.findByIdOrThrow(courseId)
  }

  async setStatus(courseId: string, status: CourseStatus): Promise<CourseEntity> {
    await this.db
      .update(courses)
      .set({
        status,
        // Un curso PUBLISHED siempre tiene fecha (constraint del esquema).
        ...(status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(courses.id, courseId))
    return this.findByIdOrThrow(courseId)
  }

  async addModule(courseId: string, title: string, orderIndex: number): Promise<string> {
    const [fila] = await this.db
      .insert(courseModules)
      .values({ courseId, title, orderIndex })
      .returning({ id: courseModules.id })
    if (!fila) throw new NotFoundException('No se pudo crear el módulo')
    return fila.id
  }

  async addLesson(input: {
    moduleId: string
    title: string
    type: LessonType
    content: string | null
    mediaAssetId: string | null
    questions: PreguntaExamen[]
    orderIndex: number
    durationSeconds: number | null
    moderationStatus?: ModerationStatus
  }): Promise<string> {
    const [fila] = await this.db
      .insert(lessons)
      .values({ ...input, moderationStatus: input.moderationStatus ?? 'APPROVED' })
      .returning({ id: lessons.id })
    if (!fila) throw new NotFoundException('No se pudo crear la lección')
    return fila.id
  }

  async moderationQueue(): Promise<ModerationCourseStat[]> {
    const filas = await this.db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        blocked: courses.blocked,
        pendientes: sql<number>`count(distinct ${lessons.id}) filter (where ${lessons.moderationStatus} = 'PENDING')`.mapWith(
          Number,
        ),
        bloqueados: sql<number>`count(distinct ${lessons.id}) filter (where ${lessons.moderationStatus} = 'BLOCKED')`.mapWith(
          Number,
        ),
      })
      .from(courses)
      .leftJoin(courseModules, eq(courseModules.courseId, courses.id))
      .leftJoin(lessons, eq(lessons.moduleId, courseModules.id))
      .where(eq(courses.status, 'PUBLISHED'))
      .groupBy(courses.id)
      .orderBy(asc(courses.title))
    return filas.map((f) => ({
      ...f,
      pendientes: Number(f.pendientes),
      bloqueados: Number(f.bloqueados),
    }))
  }

  async setLessonModeration(lessonId: string, status: ModerationStatus): Promise<void> {
    await this.db.update(lessons).set({ moderationStatus: status }).where(eq(lessons.id, lessonId))
  }

  async setCourseBlocked(courseId: string, blocked: boolean): Promise<void> {
    await this.db.update(courses).set({ blocked }).where(eq(courses.id, courseId))
  }

  async deleteLesson(lessonId: string): Promise<void> {
    await this.db.delete(lessons).where(eq(lessons.id, lessonId))
  }

  async hasAnyLesson(courseId: string): Promise<boolean> {
    return (await this.countLessons(courseId)) > 0
  }

  async slugExists(slug: string): Promise<boolean> {
    const filas = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, slug))
      .limit(1)
    return filas.length > 0
  }

  private async findByIdOrThrow(courseId: string): Promise<CourseEntity> {
    const curso = await this.findById(courseId)
    if (!curso) throw new NotFoundException('Curso no encontrado')
    return curso
  }
}
