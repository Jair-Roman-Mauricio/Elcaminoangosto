import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { DOMAIN_EVENTS, type CourseStatus } from '@elcamino/shared-types'
import { CourseAuthoringService } from './course-authoring.service'
import {
  CourseRepository,
  type CourseEntity,
  type CourseModuleEntity,
} from '../domain/course.repository'
import {
  CourseReviewRepository,
  type CourseReviewEntity,
} from '../domain/course-review.repository'

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
  publishedAt: null,
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
        return `le-${input.moduleId}`
      }
    }
    return 'le'
  }
  async findStructure(courseId: string) {
    return this.modulos.get(courseId) ?? []
  }
  async hasAnyLesson(courseId: string) {
    return this.lecciones.has(courseId)
  }
  async slugExists() {
    return false
  }
  // No usados en estos tests:
  async findAllPublished() { return [] }
  async findPublishedForLevel() { return [] }
  async findBySlug() { return null }
  async findLessonById() { return null }
  async findCourseIdByLesson() { return null }
  async countLessons() { return 0 }
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
let svc: CourseAuthoringService

beforeEach(() => {
  idSeq = 0
  cursos = new FakeCourseRepo()
  reviews = new FakeReviewRepo()
  events = new EventEmitter2()
  svc = new CourseAuthoringService(cursos, reviews, events)
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
    await expect(svc.rechazar(admin, c.id, '')).rejects.toThrow(BadRequestException)
  })

  it('rechaza con notas, audita y permite volver a borrador', async () => {
    const c = cursos.seed(nuevoCurso({ status: 'UNDER_REVIEW' }))
    expect((await svc.rechazar(admin, c.id, 'Falta profundidad')).status).toBe('REJECTED')
    const historial = await svc.historial(admin, c.id)
    expect(historial[0]!.decision).toBe('REJECTED')
    expect(historial[0]!.notes).toBe('Falta profundidad')
    // El maestro corrige: REJECTED → DRAFT.
    expect((await svc.volverABorrador(maestro, c.id)).status).toBe('DRAFT')
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
