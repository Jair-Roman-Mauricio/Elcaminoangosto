import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { DOMAIN_EVENTS, type CourseStatus } from '@elcamino/shared-types'
import { CourseAuthoringService } from './course-authoring.service'
import {
  CourseRepository,
  type CourseEntity,
  type CourseModuleEntity,
  type ModerationCourseStat,
  type ModerationStatus,
  type ObservationEntity,
} from '../domain/course.repository'
import {
  CourseReviewRepository,
  type CourseReviewEntity,
} from '../domain/course-review.repository'
import { PublishKeyRepository, type PublishKeyEntity } from '../domain/publish-key.repository'
import {
  ModerationActionRepository,
  type ModerationActionEntity,
} from '../domain/moderation-action.repository'

/* Repos en memoria: prueban la máquina de estados sin base de datos. */

let idSeq = 0
const nuevoCurso = (over: Partial<CourseEntity> = {}): CourseEntity => ({
  id: `c${++idSeq}`,
  teacherId: 'm1',
  title: 'Curso',
  slug: `curso-${idSeq}`,
  description: null,
  thumbnailAssetId: null,
  requiredLevelId: null,
  requiredLevelRank: null,
  isFree: true,
  status: 'DRAFT',
  plannedModules: 1,
  learningObjectives: [],
  purpose: null,
  coverImageUrl: null,
  publishedAt: null,
  blocked: false,
  ...over,
})

class FakeCourseRepo extends CourseRepository {
  cursos = new Map<string, CourseEntity>()
  modulos = new Map<string, CourseModuleEntity[]>()
  lecciones = new Set<string>() // courseIds que tienen ≥1 lección

  seed(c: CourseEntity) {
    this.cursos.set(c.id, c)
    return c
  }
  async findById(id: string) {
    return this.cursos.get(id) ?? null
  }
  async findByTeacher(teacherId: string) {
    return [...this.cursos.values()].filter((c) => c.teacherId === teacherId)
  }
  async findByStatus(status: CourseStatus) {
    return [...this.cursos.values()].filter((c) => c.status === status)
  }
  async setStatus(id: string, status: CourseStatus) {
    const c = this.cursos.get(id)!
    c.status = status
    if (status === 'PUBLISHED') c.publishedAt = new Date()
    return c
  }
  async createDraft(input: Parameters<CourseRepository['createDraft']>[0]) {
    return this.seed(nuevoCurso({ ...input, status: 'DRAFT' }))
  }
  async updateDraft(id: string, changes: Record<string, unknown>) {
    Object.assign(this.cursos.get(id)!, changes)
    return this.cursos.get(id)!
  }
  async addModule(courseId: string, title: string, orderIndex: number) {
    const mods = this.modulos.get(courseId) ?? []
    const id = `mo${mods.length + 1}-${courseId}`
    mods.push({ id, title, orderIndex, lessons: [] })
    this.modulos.set(courseId, mods)
    return id
  }
  async addLesson(input: Parameters<CourseRepository['addLesson']>[0]) {
    for (const [cid, mods] of this.modulos) {
      const m = mods.find((x) => x.id === input.moduleId)
      if (m) {
        this.lecciones.add(cid)
        const id = `le-${m.lessons.length + 1}-${input.moduleId}`
        m.lessons.push({
          id,
          moduleId: input.moduleId,
          title: input.title,
          type: input.type,
          content: input.content,
          mediaAssetId: input.mediaAssetId,
          questions: input.questions,
          orderIndex: input.orderIndex,
          durationSeconds: input.durationSeconds,
          moderationStatus: input.moderationStatus ?? 'APPROVED',
        })
        return id
      }
    }
    return 'le'
  }
  async findStructure(courseId: string, opts?: { soloAprobadas?: boolean }) {
    const mods = this.modulos.get(courseId) ?? []
    if (!opts?.soloAprobadas) return mods
    return mods.map((m) => ({
      ...m,
      lessons: m.lessons.filter((l) => l.moderationStatus === 'APPROVED'),
    }))
  }
  async hasAnyLesson(courseId: string) {
    return this.lecciones.has(courseId)
  }
  async slugExists() {
    return false
  }
  async findLessonById(lessonId: string) {
    return this.todasLasLecciones().find((l) => l.id === lessonId) ?? null
  }
  async findCourseIdByLesson(lessonId: string) {
    for (const [courseId, mods] of this.modulos) {
      if (mods.some((m) => m.lessons.some((l) => l.id === lessonId))) return courseId
    }
    return null
  }
  async setLessonModeration(lessonId: string, status: ModerationStatus) {
    const leccion = this.todasLasLecciones().find((l) => l.id === lessonId)
    if (leccion) leccion.moderationStatus = status
  }
  async setCourseBlocked(courseId: string, blocked: boolean) {
    const curso = this.cursos.get(courseId)
    if (curso) curso.blocked = blocked
  }
  async moderationQueue(): Promise<ModerationCourseStat[]> {
    return [...this.cursos.values()]
      .filter((c) => c.status === 'PUBLISHED')
      .map((c) => {
        const lecciones = (this.modulos.get(c.id) ?? []).flatMap((m) => m.lessons)
        return {
          id: c.id,
          title: c.title,
          slug: c.slug,
          blocked: c.blocked,
          pendientes: lecciones.filter((l) => l.moderationStatus === 'PENDING').length,
          bloqueados: lecciones.filter((l) => l.moderationStatus === 'BLOCKED').length,
        }
      })
  }
  private todasLasLecciones() {
    return [...this.modulos.values()].flatMap((mods) => mods.flatMap((m) => m.lessons))
  }
  // No usados en estos tests:
  async findAllPublished() { return [] }
  async findPublishedForLevel() { return [] }
  async findBySlug() { return null }
  async countLessons() { return 0 }
  async completionStatsByTeacher() { return [] }
  async createObservation(input: Parameters<CourseRepository['createObservation']>[0]) {
    const obs: ObservationEntity = {
      id: `o${this.observaciones.length + 1}`,
      resolvedAt: null,
      createdAt: new Date(),
      ...input,
    }
    this.observaciones.push(obs)
    return obs
  }
  observaciones: ObservationEntity[] = []
  async listObservations(courseId: string) {
    return this.observaciones.filter((o) => o.courseId === courseId)
  }
  async findObservationById(id: string) {
    return this.observaciones.find((o) => o.id === id) ?? null
  }
  async deleteObservation(id: string) {
    this.observaciones = this.observaciones.filter((o) => o.id !== id)
  }
  borradas: string[] = []
  async deleteLesson(lessonId: string) {
    this.borradas.push(lessonId)
  }
}

/** Llaves de publicación: no se ejercitan aquí, basta con el puerto vacío. */
class FakePublishKeyRepo extends PublishKeyRepository {
  llaves: PublishKeyEntity[] = []
  async create(code: string, createdBy: string) {
    const llave: PublishKeyEntity = {
      id: `k${this.llaves.length + 1}`,
      code,
      createdBy,
      usedBy: null,
      usedCourseId: null,
      usedAt: null,
      createdAt: new Date(),
    }
    this.llaves.push(llave)
    return llave
  }
  async findByCode(code: string) {
    return this.llaves.find((l) => l.code === code) ?? null
  }
  async markUsed(id: string, usedBy: string, courseId: string) {
    const llave = this.llaves.find((l) => l.id === id)
    if (llave) Object.assign(llave, { usedBy, usedCourseId: courseId, usedAt: new Date() })
  }
  async findAll() {
    return this.llaves
  }
}

/** Bitácora de moderación en memoria (HU-7.2). */
class FakeModerationRepo extends ModerationActionRepository {
  filas: ModerationActionEntity[] = []
  async create(input: Parameters<ModerationActionRepository['create']>[0]) {
    const fila: ModerationActionEntity = {
      id: `ma${this.filas.length + 1}`,
      moderatorName: 'Ana',
      createdAt: new Date(),
      ...input,
    }
    this.filas.push(fila)
    return fila
  }
  async findByCourse(courseId: string) {
    return this.filas.filter((f) => f.courseId === courseId)
  }
}

/** Fake mínimo de MediaService: solo registra los assets eliminados. */
class FakeMedia {
  eliminados: string[] = []
  async eliminar(assetId: string) {
    this.eliminados.push(assetId)
  }
}

class FakeReviewRepo extends CourseReviewRepository {
  filas: CourseReviewEntity[] = []
  async create(input: Parameters<CourseReviewRepository['create']>[0]) {
    const r: CourseReviewEntity = {
      id: `r${this.filas.length + 1}`,
      reviewerName: 'Ana',
      reviewedAt: new Date(),
      ...input,
    }
    this.filas.push(r)
    return r
  }
  async findByCourse(courseId: string) {
    return this.filas.filter((r) => r.courseId === courseId)
  }
}

const maestro = { id: 'm1', role: 'MAESTRO' as const, levelRank: 0 }
const otroMaestro = { id: 'm2', role: 'MAESTRO' as const, levelRank: 0 }
const admin = { id: 'a1', role: 'ADMIN' as const, levelRank: 0 }

let cursos: FakeCourseRepo
let reviews: FakeReviewRepo
let events: EventEmitter2
let media: FakeMedia
let llaves: FakePublishKeyRepo
let moderaciones: FakeModerationRepo
let svc: CourseAuthoringService

beforeEach(() => {
  idSeq = 0
  cursos = new FakeCourseRepo()
  reviews = new FakeReviewRepo()
  events = new EventEmitter2()
  media = new FakeMedia()
  llaves = new FakePublishKeyRepo()
  moderaciones = new FakeModerationRepo()
  svc = new CourseAuthoringService(cursos, reviews, events, media as never, llaves, moderaciones)
})

describe('autoría (HU-4.3)', () => {
  it('crea un borrador en estado DRAFT', async () => {
    const c = await svc.crearBorrador(maestro, {
      title: 'La puerta angosta',
      description: null,
      requiredLevelId: 'nivel-1',
      isFree: true,
      plannedModules: 1,
    })
    expect(c.status).toBe('DRAFT')
    expect(c.isFree).toBe(true)
    expect(c.requiredLevelId).toBe('nivel-1')
  })

  it('un estudiante no puede crear cursos', async () => {
    const estudiante = { id: 'e1', role: 'ESTUDIANTE' as const, levelRank: 1 }
    await expect(
      svc.crearBorrador(estudiante, {
        title: 'x',
        description: null,
        requiredLevelId: null,
        isFree: true,
        plannedModules: 0,
      }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('un maestro no edita el borrador de otro', async () => {
    const c = cursos.seed(nuevoCurso({ teacherId: 'm1' }))
    await expect(svc.editarBorrador(otroMaestro, c.id, { title: 'x' })).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('la vista editable conserva las condiciones de acceso del borrador', async () => {
    const c = cursos.seed(nuevoCurso({
      requiredLevelId: 'nivel-2',
      requiredLevelRank: 2,
      isFree: true,
      plannedModules: 3,
    }))

    const vista = await svc.vistaDeEstudiante(maestro, c.id)

    expect(vista).toMatchObject({
      requiredLevelId: 'nivel-2',
      requiredLevelRank: 2,
      isFree: true,
      plannedModules: 3,
    })
  })
})

describe('máquina de estados — camino feliz (hito S2)', () => {
  it('DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → PUBLISHED', async () => {
    const spySub = vi.fn()
    const spyRev = vi.fn()
    const spyPub = vi.fn()
    events.on(DOMAIN_EVENTS.COURSE_SUBMITTED, spySub)
    events.on(DOMAIN_EVENTS.COURSE_REVIEWED, spyRev)
    events.on(DOMAIN_EVENTS.COURSE_PUBLISHED, spyPub)

    const c = cursos.seed(nuevoCurso())
    // El maestro añade un módulo y una lección (requisito para enviar).
    const moduleId = await svc.agregarModulo(maestro, c.id, 'Módulo 1')
    await svc.agregarLeccion(maestro, c.id, moduleId, {
      title: 'L1',
      type: 'TEXT',
      content: 'texto',
      mediaAssetId: null,
      questions: [],
      durationSeconds: null,
    })

    expect((await svc.enviarARevision(maestro, c.id)).status).toBe('SUBMITTED')
    expect(spySub).toHaveBeenCalledOnce()

    expect((await svc.tomarParaRevisar(admin, c.id)).status).toBe('UNDER_REVIEW')
    expect((await svc.aprobar(admin, c.id, 'Buen trabajo')).status).toBe('APPROVED')
    expect(spyRev).toHaveBeenCalledOnce()

    expect((await svc.publicar(admin, c.id)).status).toBe('PUBLISHED')
    expect(spyPub).toHaveBeenCalledOnce()

    // La aprobación quedó auditada.
    const historial = await svc.historial(admin, c.id)
    expect(historial).toHaveLength(1)
    expect(historial[0]!.decision).toBe('APPROVED')
  })
})

describe('la regla inviolable: un maestro nunca autopublica', () => {
  it('DRAFT → PUBLISHED es una transición inválida', async () => {
    const c = cursos.seed(nuevoCurso({ status: 'DRAFT' }))
    await expect(svc.publicar(maestro, c.id)).rejects.toThrow(BadRequestException)
    expect((await cursos.findById(c.id))!.status).toBe('DRAFT')
  })

  it('SUBMITTED → PUBLISHED también es inválida', async () => {
    const c = cursos.seed(nuevoCurso({ status: 'SUBMITTED' }))
    await expect(svc.publicar(admin, c.id)).rejects.toThrow(BadRequestException)
  })
})

describe('envío a revisión', () => {
  it('no se puede enviar un curso sin lecciones', async () => {
    const c = cursos.seed(nuevoCurso({ status: 'DRAFT' }))
    await expect(svc.enviarARevision(maestro, c.id)).rejects.toThrow(BadRequestException)
  })
})

describe('rechazo (HU-5.2)', () => {
  it('un rechazo exige notas', async () => {
    const c = cursos.seed(nuevoCurso({ status: 'UNDER_REVIEW' }))
    await expect(svc.rechazar(admin, c.id, { notes: '' })).rejects.toThrow(BadRequestException)
  })

  it('rechaza con notas, audita y permite volver a borrador', async () => {
    const c = cursos.seed(nuevoCurso({ status: 'UNDER_REVIEW' }))
    expect((await svc.rechazar(admin, c.id, { notes: 'Falta profundidad' })).status).toBe('REJECTED')
    const historial = await svc.historial(admin, c.id)
    expect(historial[0]!.decision).toBe('REJECTED')
    expect(historial[0]!.notes).toBe('Falta profundidad')
    // El maestro corrige: REJECTED → DRAFT.
    expect((await svc.volverABorrador(maestro, c.id)).status).toBe('DRAFT')
  })

  async function cursoConDosLecciones() {
    const c = cursos.seed(nuevoCurso({ status: 'UNDER_REVIEW' }))
    const mo = await cursos.addModule(c.id, 'M1', 0)
    const l1 = await cursos.addLesson({ moduleId: mo, title: 'L1', type: 'TEXT', content: 'x', mediaAssetId: null, questions: [], orderIndex: 0, durationSeconds: null })
    const l2 = await cursos.addLesson({ moduleId: mo, title: 'L2', type: 'VIDEO', content: null, mediaAssetId: 'asset-2', questions: [], orderIndex: 1, durationSeconds: 10 })
    return { c, l1, l2 }
  }

  it('primer rechazo: borra solo las lecciones marcadas y su video', async () => {
    const { c, l2 } = await cursoConDosLecciones()
    await svc.rechazar(admin, c.id, { notes: 'Corrige el video', lessonIds: [l2] })
    expect(cursos.borradas).toEqual([l2])
    expect(media.eliminados).toEqual(['asset-2']) // el video marcado se elimina
  })

  it('segundo rechazo: borra TODAS las lecciones', async () => {
    const { c, l1, l2 } = await cursoConDosLecciones()
    reviews.filas.push({ id: 'r0', courseId: c.id, reviewerId: 'a1', reviewerName: 'Ana', decision: 'REJECTED', notes: 'antes', reviewedAt: new Date() })
    await svc.rechazar(admin, c.id, { notes: 'Otra vez mal' })
    expect(new Set(cursos.borradas)).toEqual(new Set([l1, l2]))
    expect(media.eliminados).toEqual(['asset-2'])
  })

  it('borrarTodo: elimina todo aunque sea el primer rechazo', async () => {
    const { c, l1, l2 } = await cursoConDosLecciones()
    await svc.rechazar(admin, c.id, { notes: 'Rehaz todo', borrarTodo: true })
    expect(new Set(cursos.borradas)).toEqual(new Set([l1, l2]))
  })

  it('un maestro no puede aprobar ni tomar cursos', async () => {
    const c = cursos.seed(nuevoCurso({ status: 'SUBMITTED' }))
    await expect(svc.tomarParaRevisar(maestro, c.id)).rejects.toThrow(ForbiddenException)
    await expect(svc.aprobar(maestro, c.id, null)).rejects.toThrow(ForbiddenException)
  })
})

describe('cola de revisión', () => {
  it('lista los cursos SUBMITTED y UNDER_REVIEW', async () => {
    cursos.seed(nuevoCurso({ status: 'SUBMITTED' }))
    cursos.seed(nuevoCurso({ status: 'UNDER_REVIEW' }))
    cursos.seed(nuevoCurso({ status: 'DRAFT' }))
    cursos.seed(nuevoCurso({ status: 'PUBLISHED' }))
    const cola = await svc.colaDeRevision(admin)
    expect(cola).toHaveLength(2)
  })
})

describe('moderación de cursos publicados (HU-7.2)', () => {
  /** Curso publicado con un contenido añadido después de publicar. */
  async function cursoPublicadoConContenidoNuevo() {
    const c = cursos.seed(nuevoCurso({ status: 'PUBLISHED' }))
    const moduleId = await cursos.addModule(c.id, 'M1', 0)
    const lessonId = await svc.agregarLeccion(maestro, c.id, moduleId, {
      title: 'Añadido después',
      type: 'TEXT',
      content: 'texto',
      mediaAssetId: null,
      questions: [],
      durationSeconds: null,
    })
    return { c, lessonId }
  }

  it('lo añadido a un curso publicado nace PENDIENTE y no lo ve el estudiante', async () => {
    const { c, lessonId } = await cursoPublicadoConContenidoNuevo()

    expect((await cursos.findLessonById(lessonId))!.moderationStatus).toBe('PENDING')
    const visibles = await cursos.findStructure(c.id, { soloAprobadas: true })
    expect(visibles.flatMap((m) => m.lessons)).toHaveLength(0)
  })

  it('el admin aprueba el contenido: se publica, queda auditado y avisa al maestro', async () => {
    const { c, lessonId } = await cursoPublicadoConContenidoNuevo()
    const spy = vi.fn()
    events.on(DOMAIN_EVENTS.CONTENT_MODERATED, spy)

    await svc.moderarLeccion(admin, lessonId, 'APPROVED')

    expect((await cursos.findLessonById(lessonId))!.moderationStatus).toBe('APPROVED')
    const bitacora = await svc.bitacoraDeModeracion(admin, c.id)
    expect(bitacora).toHaveLength(1)
    expect(bitacora[0]).toMatchObject({
      action: 'LESSON_APPROVED',
      lessonId,
      lessonTitle: 'Añadido después',
      moderatorId: admin.id,
    })
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: c.id, teacherId: 'm1', action: 'LESSON_APPROVED' }),
    )
  })

  it('el admin bloquea un contenido para que el maestro lo corrija', async () => {
    const { c, lessonId } = await cursoPublicadoConContenidoNuevo()

    await svc.moderarLeccion(admin, lessonId, 'BLOCKED')

    expect((await cursos.findLessonById(lessonId))!.moderationStatus).toBe('BLOCKED')
    expect((await svc.bitacoraDeModeracion(admin, c.id))[0]!.action).toBe('LESSON_BLOCKED')
  })

  it('no se modera dos veces al mismo estado', async () => {
    const { lessonId } = await cursoPublicadoConContenidoNuevo()
    await expect(svc.moderarLeccion(admin, lessonId, 'PENDING')).rejects.toThrow(BadRequestException)
  })

  it('solo se modera el contenido de un curso publicado', async () => {
    const c = cursos.seed(nuevoCurso({ status: 'DRAFT' }))
    const moduleId = await cursos.addModule(c.id, 'M1', 0)
    const lessonId = await svc.agregarLeccion(maestro, c.id, moduleId, {
      title: 'Borrador',
      type: 'TEXT',
      content: 'texto',
      mediaAssetId: null,
      questions: [],
      durationSeconds: null,
    })

    await expect(svc.moderarLeccion(admin, lessonId, 'BLOCKED')).rejects.toThrow(BadRequestException)
  })

  it('un maestro no modera ni bloquea', async () => {
    const { c, lessonId } = await cursoPublicadoConContenidoNuevo()
    await expect(svc.moderarLeccion(maestro, lessonId, 'APPROVED')).rejects.toThrow(ForbiddenException)
    await expect(svc.bloquearCurso(maestro, c.id, true)).rejects.toThrow(ForbiddenException)
  })

  it('bloquear y reactivar el curso queda auditado; repetir la acción falla', async () => {
    const c = cursos.seed(nuevoCurso({ status: 'PUBLISHED' }))

    await svc.bloquearCurso(admin, c.id, true)
    expect((await cursos.findById(c.id))!.blocked).toBe(true)
    await expect(svc.bloquearCurso(admin, c.id, true)).rejects.toThrow(BadRequestException)

    await svc.bloquearCurso(admin, c.id, false)
    expect((await cursos.findById(c.id))!.blocked).toBe(false)

    expect((await svc.bitacoraDeModeracion(admin, c.id)).map((a) => a.action)).toEqual([
      'COURSE_BLOCKED',
      'COURSE_UNBLOCKED',
    ])
  })

  it('un curso en borrador no se bloquea: la moderación es para lo publicado', async () => {
    const c = cursos.seed(nuevoCurso({ status: 'DRAFT' }))
    await expect(svc.bloquearCurso(admin, c.id, true)).rejects.toThrow(BadRequestException)
  })

  it('la cola cuenta pendientes y bloqueados de cada curso publicado', async () => {
    const { c, lessonId } = await cursoPublicadoConContenidoNuevo()
    cursos.seed(nuevoCurso({ status: 'DRAFT' }))

    expect(await svc.colaDeModeracion(admin)).toEqual([
      expect.objectContaining({ id: c.id, pendientes: 1, bloqueados: 0, blocked: false }),
    ])

    await svc.moderarLeccion(admin, lessonId, 'BLOCKED')
    expect(await svc.colaDeModeracion(admin)).toEqual([
      expect.objectContaining({ id: c.id, pendientes: 0, bloqueados: 1 }),
    ])
  })

  it('el maestro dueño ve la bitácora de su curso; otro maestro no', async () => {
    const { c, lessonId } = await cursoPublicadoConContenidoNuevo()
    await svc.moderarLeccion(admin, lessonId, 'BLOCKED')

    expect(await svc.bitacoraDeModeracion(maestro, c.id)).toHaveLength(1)
    await expect(svc.bitacoraDeModeracion(otroMaestro, c.id)).rejects.toThrow(ForbiddenException)
  })

  it('la bitácora conserva el título aunque la lección se borre', async () => {
    const { c, lessonId } = await cursoPublicadoConContenidoNuevo()
    await svc.moderarLeccion(admin, lessonId, 'BLOCKED')
    await cursos.deleteLesson(lessonId)

    expect((await svc.bitacoraDeModeracion(admin, c.id))[0]!.lessonTitle).toBe('Añadido después')
    expect(moderaciones.filas).toHaveLength(1)
  })
})
