import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { DOMAIN_EVENTS } from '@elcamino/shared-types'
import { DiscipleshipService } from './discipleship.service'
import {
  CourseRepository,
  type CourseCardEntity,
  type CourseEntity,
  type CourseModuleEntity,
  type LessonEntity,
} from '../domain/course.repository'
import {
  EnrollmentRepository,
  type EnrollmentEntity,
  type StudentProgressRow,
} from '../domain/enrollment.repository'

/* Repos en memoria: prueban la lógica de negocio sin base de datos. */

const CURSO_N1: CourseEntity = {
  id: 'c1',
  teacherId: 'm1',
  title: 'La puerta angosta',
  slug: 'la-puerta-angosta',
  description: null,
  thumbnailAssetId: null,
  requiredLevelId: 'l1',
  requiredLevelRank: 1,
  isFree: true,
  status: 'PUBLISHED',
  plannedModules: 1,
  learningObjectives: [],
  purpose: null,
  coverImageUrl: null,
  publishedAt: new Date(),
  blocked: false,
}
const CURSO_N3: CourseEntity = { ...CURSO_N1, id: 'c3', slug: 'avanzado', requiredLevelRank: 3 }
const BORRADOR: CourseEntity = { ...CURSO_N1, id: 'cd', slug: 'draft', status: 'DRAFT' }
/** Curso publicado pero bloqueado por moderación (HU-7.2). */
const BLOQUEADO: CourseEntity = { ...CURSO_N1, id: 'cb', slug: 'bloqueado', blocked: true }

const nuevaLeccion = (over: Partial<LessonEntity> & { id: string }): LessonEntity => ({
  moduleId: 'mo1',
  title: 'Lección',
  type: 'TEXT',
  content: 'x',
  mediaAssetId: null,
  questions: [],
  orderIndex: 0,
  durationSeconds: null,
  moderationStatus: 'APPROVED',
  ...over,
})

class FakeCourseRepo extends CourseRepository {
  cursos = new Map<string, CourseEntity>([
    [CURSO_N1.id, CURSO_N1],
    [CURSO_N3.id, CURSO_N3],
    [BORRADOR.id, BORRADOR],
    [BLOQUEADO.id, BLOQUEADO],
  ])
  lecciones = new Map<string, LessonEntity>([
    ['le1', nuevaLeccion({ id: 'le1', title: 'L1' })],
    ['le2', nuevaLeccion({ id: 'le2', title: 'L2', type: 'VIDEO', content: null, mediaAssetId: 'media-1', orderIndex: 1, durationSeconds: 60 })],
  ])
  moduloDeCurso = new Map<string, string>([['mo1', 'c1']])

  /** Añade una lección aún sin aprobar por moderación. */
  seedPendiente(id: string, over: Partial<LessonEntity> = {}) {
    const leccion = nuevaLeccion({ id, moderationStatus: 'PENDING', ...over })
    this.lecciones.set(id, leccion)
    return leccion
  }

  async findAllPublished(): Promise<CourseCardEntity[]> {
    return [...this.cursos.values()]
      .filter((c) => c.status === 'PUBLISHED' && !c.blocked)
      .map((c) => ({
        id: c.id, title: c.title, slug: c.slug, description: c.description,
        thumbnailAssetId: c.thumbnailAssetId, requiredLevelId: c.requiredLevelId,
        requiredLevelRank: c.requiredLevelRank, isFree: c.isFree,
        coverImageUrl: c.coverImageUrl,
        teacherName: 'Marcos', moduleCount: 1, lessonCount: 2,
      }))
  }
  async findPublishedForLevel() { return this.findAllPublished() }
  async findById(id: string) { return this.cursos.get(id) ?? null }
  async findBySlug(slug: string) { return [...this.cursos.values()].find((c) => c.slug === slug) ?? null }
  async findStructure(_courseId: string, opts?: { soloAprobadas?: boolean }): Promise<CourseModuleEntity[]> {
    const todas = [...this.lecciones.values()]
    const lessons = opts?.soloAprobadas
      ? todas.filter((l) => l.moderationStatus === 'APPROVED')
      : todas
    return [{ id: 'mo1', title: 'Módulo 1', orderIndex: 0, lessons }]
  }
  async findLessonById(id: string) { return this.lecciones.get(id) ?? null }
  async findCourseIdByLesson(id: string) {
    const l = this.lecciones.get(id)
    return l ? (this.moduloDeCurso.get(l.moduleId) ?? null) : null
  }
  async countLessons(_courseId: string, opts?: { soloAprobadas?: boolean }) {
    const todas = [...this.lecciones.values()]
    return opts?.soloAprobadas
      ? todas.filter((l) => l.moderationStatus === 'APPROVED').length
      : todas.length
  }
}

class FakeEnrollmentRepo extends EnrollmentRepository {
  filas: EnrollmentEntity[] = []
  progreso = new Map<string, Set<string>>()

  async findByStudentAndCourse(s: string, c: string) {
    return this.filas.find((e) => e.studentId === s && e.courseId === c) ?? null
  }
  async findWithProgress(id: string) {
    const e = this.filas.find((f) => f.id === id)
    return e ? { ...e, completedLessonIds: [...(this.progreso.get(id) ?? [])] } : null
  }
  async findCourseIdsByStudent(s: string) {
    return this.filas.filter((e) => e.studentId === s).map((e) => e.courseId)
  }
  async create(studentId: string, courseId: string) {
    const e: EnrollmentEntity = { id: `e${this.filas.length + 1}`, studentId, courseId, status: 'ACTIVE', progressPct: 0 }
    this.filas.push(e)
    return e
  }
  async completeLesson(enrollmentId: string, lessonId: string, total: number) {
    const set = this.progreso.get(enrollmentId) ?? new Set()
    set.add(lessonId)
    this.progreso.set(enrollmentId, set)
    const e = this.filas.find((f) => f.id === enrollmentId)!
    e.progressPct = Math.min(100, (set.size / total) * 100)
    e.status = set.size >= total ? 'COMPLETED' : 'ACTIVE'
    return e
  }
  async findRosterByCourse(): Promise<StudentProgressRow[]> { return [] }
}

const estudianteN2 = { id: 'e1', role: 'ESTUDIANTE' as const, levelRank: 2 }
const estudianteN1 = { id: 'e2', role: 'ESTUDIANTE' as const, levelRank: 1 }

let cursos: FakeCourseRepo
let inscripciones: FakeEnrollmentRepo
let events: EventEmitter2
let service: DiscipleshipService

beforeEach(() => {
  cursos = new FakeCourseRepo()
  inscripciones = new FakeEnrollmentRepo()
  events = new EventEmitter2()
  service = new DiscipleshipService(cursos, inscripciones, events)
})

describe('catálogo por nivel (HU-4.1)', () => {
  it('marca bloqueados los cursos de nivel superior, con motivo', async () => {
    const items = await service.catalogo(estudianteN2)
    const n1 = items.find((i) => i.id === 'c1')!
    const n3 = items.find((i) => i.id === 'c3')!

    expect(n1.unlocked).toBe(true)
    expect(n1.lockedReason).toBeNull()

    expect(n3.unlocked).toBe(false)
    expect(n3.lockedReason).toBe('Requiere el nivel 3. Tu nivel actual es 2.')
  })

  it('no incluye borradores', async () => {
    const items = await service.catalogo(estudianteN2)
    expect(items.find((i) => i.slug === 'draft')).toBeUndefined()
  })

  it('refleja en qué cursos ya está inscrito', async () => {
    await inscripciones.create('e1', 'c1')
    const items = await service.catalogo(estudianteN2)
    expect(items.find((i) => i.id === 'c1')!.enrolled).toBe(true)
    expect(items.find((i) => i.id === 'c3')!.enrolled).toBe(false)
  })
})

describe('inscripción (HU-4.1)', () => {
  it('inscribe a un curso permitido', async () => {
    const e = await service.inscribirse(estudianteN2, 'c1')
    expect(e.courseId).toBe('c1')
    expect(e.status).toBe('ACTIVE')
  })

  it('rechaza con 403 y motivo un curso de nivel superior', async () => {
    await expect(service.inscribirse(estudianteN1, 'c3')).rejects.toThrow(ForbiddenException)
  })

  it('es idempotente: dos veces devuelve la misma inscripción', async () => {
    const a = await service.inscribirse(estudianteN2, 'c1')
    const b = await service.inscribirse(estudianteN2, 'c1')
    expect(b.id).toBe(a.id)
    expect(inscripciones.filas).toHaveLength(1)
  })

  it('no permite inscribirse a un borrador', async () => {
    await expect(service.inscribirse(estudianteN2, 'cd')).rejects.toThrow(NotFoundException)
  })
})

describe('progreso de lecciones (HU-4.2)', () => {
  it('un no inscrito no puede completar lecciones', async () => {
    await expect(service.completarLeccion(estudianteN2, 'le1')).rejects.toThrow(ForbiddenException)
  })

  it('completar lecciones sube el progreso y emite LessonCompleted', async () => {
    await service.inscribirse(estudianteN2, 'c1')
    const spy = vi.fn()
    events.on(DOMAIN_EVENTS.LESSON_COMPLETED, spy)

    const r1 = await service.completarLeccion(estudianteN2, 'le1')
    expect(r1.progressPct).toBe(50)
    expect(r1.courseCompleted).toBe(false)
    expect(spy).toHaveBeenCalledOnce()

    const r2 = await service.completarLeccion(estudianteN2, 'le2')
    expect(r2.progressPct).toBe(100)
    expect(r2.courseCompleted).toBe(true)
  })

  it('completar dos veces la misma lección no pasa del 50%', async () => {
    await service.inscribirse(estudianteN2, 'c1')
    await service.completarLeccion(estudianteN2, 'le1')
    const r = await service.completarLeccion(estudianteN2, 'le1')
    expect(r.progressPct).toBe(50)
  })
})

describe('medio privado de lección (HU-4.2 / HU-8.3)', () => {
  it('un inscrito obtiene el assetId a firmar', async () => {
    await service.inscribirse(estudianteN2, 'c1')
    await expect(service.autorizarMedioDeLeccion(estudianteN2, 'le2')).resolves.toBe('media-1')
  })

  it('un no inscrito no obtiene el medio', async () => {
    await expect(service.autorizarMedioDeLeccion(estudianteN2, 'le2')).rejects.toThrow(ForbiddenException)
  })

  it('el admin accede sin inscripción', async () => {
    const admin = { id: 'a1', role: 'ADMIN' as const, levelRank: 0 }
    await expect(service.autorizarMedioDeLeccion(admin, 'le2')).resolves.toBe('media-1')
  })
})

describe('contenido moderado: lo que el estudiante no debe ver (HU-7.2)', () => {
  it('un curso bloqueado no aparece en el catálogo ni abre su ficha', async () => {
    const items = await service.catalogo(estudianteN2)
    expect(items.find((i) => i.slug === 'bloqueado')).toBeUndefined()
    await expect(service.fichaPorSlug(estudianteN2, 'bloqueado')).rejects.toThrow(NotFoundException)
  })

  it('no se puede inscribir en un curso bloqueado', async () => {
    await expect(service.inscribirse(estudianteN2, 'cb')).rejects.toThrow(NotFoundException)
  })

  it('la ficha oculta el contenido pendiente o bloqueado', async () => {
    cursos.seedPendiente('le3', { title: 'Nuevo' })
    cursos.seedPendiente('le4', { title: 'Retirado', moderationStatus: 'BLOCKED' })

    const ficha = await service.fichaPorSlug(estudianteN2, 'la-puerta-angosta')

    expect(ficha.modules[0]!.lessons.map((l) => l.id)).toEqual(['le1', 'le2'])
  })

  it('el progreso solo cuenta el contenido aprobado: se llega al 100%', async () => {
    cursos.seedPendiente('le3')
    await service.inscribirse(estudianteN2, 'c1')

    await service.completarLeccion(estudianteN2, 'le1')
    const r = await service.completarLeccion(estudianteN2, 'le2')

    expect(r.progressPct).toBe(100)
    expect(r.courseCompleted).toBe(true)
  })

  it('no se completa ni se obtiene el medio de un contenido sin aprobar', async () => {
    cursos.seedPendiente('le3', { mediaAssetId: 'media-2' })
    await service.inscribirse(estudianteN2, 'c1')

    await expect(service.completarLeccion(estudianteN2, 'le3')).rejects.toThrow(NotFoundException)
    await expect(service.autorizarMedioDeLeccion(estudianteN2, 'le3')).rejects.toThrow(NotFoundException)
  })

  it('el admin sí accede al medio de un contenido pendiente: lo tiene que moderar', async () => {
    cursos.seedPendiente('le3', { mediaAssetId: 'media-2' })
    const admin = { id: 'a1', role: 'ADMIN' as const, levelRank: 0 }
    await expect(service.autorizarMedioDeLeccion(admin, 'le3')).resolves.toBe('media-2')
  })

  it('una evaluación sin aprobar no se califica', async () => {
    cursos.seedPendiente('le5', { type: 'EXAM', content: null, questions: [{ enunciado: '¿?', opciones: ['a', 'b'], correcta: 0 }] })
    await service.inscribirse(estudianteN2, 'c1')

    await expect(service.calificarEvaluacion(estudianteN2, 'le5', [0])).rejects.toThrow(NotFoundException)
  })
})
