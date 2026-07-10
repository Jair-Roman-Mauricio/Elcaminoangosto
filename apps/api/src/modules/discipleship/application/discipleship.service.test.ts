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
  publishedAt: new Date(),
}
const CURSO_N3: CourseEntity = { ...CURSO_N1, id: 'c3', slug: 'avanzado', requiredLevelRank: 3 }
const BORRADOR: CourseEntity = { ...CURSO_N1, id: 'cd', slug: 'draft', status: 'DRAFT' }

class FakeCourseRepo extends CourseRepository {
  cursos = new Map<string, CourseEntity>([
    [CURSO_N1.id, CURSO_N1],
    [CURSO_N3.id, CURSO_N3],
    [BORRADOR.id, BORRADOR],
  ])
  lecciones = new Map<string, LessonEntity>([
    ['le1', { id: 'le1', moduleId: 'mo1', title: 'L1', type: 'TEXT', content: 'x', mediaAssetId: null, orderIndex: 0, durationSeconds: null }],
    ['le2', { id: 'le2', moduleId: 'mo1', title: 'L2', type: 'VIDEO', content: null, mediaAssetId: 'media-1', orderIndex: 1, durationSeconds: 60 }],
  ])
  moduloDeCurso = new Map<string, string>([['mo1', 'c1']])

  async findAllPublished(): Promise<CourseCardEntity[]> {
    return [...this.cursos.values()]
      .filter((c) => c.status === 'PUBLISHED')
      .map((c) => ({
        id: c.id, title: c.title, slug: c.slug, description: c.description,
        thumbnailAssetId: c.thumbnailAssetId, requiredLevelId: c.requiredLevelId,
        requiredLevelRank: c.requiredLevelRank, isFree: c.isFree,
        teacherName: 'Marcos', moduleCount: 1, lessonCount: 2,
      }))
  }
  async findPublishedForLevel() { return this.findAllPublished() }
  async findById(id: string) { return this.cursos.get(id) ?? null }
  async findBySlug(slug: string) { return [...this.cursos.values()].find((c) => c.slug === slug) ?? null }
  async findStructure(): Promise<CourseModuleEntity[]> {
    return [{ id: 'mo1', title: 'Módulo 1', orderIndex: 0, lessons: [...this.lecciones.values()] }]
  }
  async findLessonById(id: string) { return this.lecciones.get(id) ?? null }
  async findCourseIdByLesson(id: string) {
    const l = this.lecciones.get(id)
    return l ? (this.moduloDeCurso.get(l.moduleId) ?? null) : null
  }
  async countLessons() { return 2 }
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
