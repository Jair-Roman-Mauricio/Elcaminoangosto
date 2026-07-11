import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  DOMAIN_EVENTS,
  canTransition,
  type CourseStatus,
  type CourseSubmittedEvent,
  type CoursePublishedEvent,
} from '@elcamino/shared-types'
import { CourseRepository, type CourseEntity } from '../domain/course.repository'
import {
  CourseReviewRepository,
  type CourseReviewEntity,
} from '../domain/course-review.repository'
import { puedeEditarRecurso, type Actor } from '../../shared'

/**
 * Autoría de cursos y flujo de aprobación (E4-HU4.3, E5).
 *
 * INVARIANTE INVIOLABLE: un curso de maestro nunca se autopublica. Toda
 * transición pasa por `canTransition` (shared-types), que no admite
 * DRAFT→PUBLISHED. Aquí no hay ningún atajo.
 */
@Injectable()
export class CourseAuthoringService {
  constructor(
    private readonly courses: CourseRepository,
    private readonly reviews: CourseReviewRepository,
    private readonly events: EventEmitter2,
  ) {}

  // ── Autoría (HU-4.3) ──────────────────────────────────────────────────────

  /** Mis cursos, en cualquier estado (para el maestro). */
  async misCursos(teacherId: string): Promise<CourseEntity[]> {
    return this.courses.findByTeacher(teacherId)
  }

  /** Crea un borrador. Nace en DRAFT (lo garantiza el repositorio). */
  async crearBorrador(
    actor: Actor,
    input: {
      title: string
      description: string | null
      requiredLevelId: string | null
      isFree: boolean
      plannedModules: number
    },
  ): Promise<CourseEntity> {
    if (actor.role !== 'MAESTRO' && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un maestro puede crear cursos')
    }
    const slug = await this.slugUnico(input.title)
    return this.courses.createDraft({ ...input, teacherId: actor.id, slug })
  }

  /** Edita un borrador. Solo el dueño, y solo mientras es DRAFT o REJECTED. */
  async editarBorrador(
    actor: Actor,
    courseId: string,
    changes: {
      title?: string | undefined
      description?: string | null | undefined
      requiredLevelId?: string | null | undefined
      isFree?: boolean | undefined
      plannedModules?: number | undefined
    },
  ): Promise<CourseEntity> {
    const curso = await this.mioEditable(actor, courseId)
    if (curso.status !== 'DRAFT' && curso.status !== 'REJECTED') {
      throw new BadRequestException('Solo puedes editar un curso en borrador o rechazado')
    }
    return this.courses.updateDraft(courseId, changes)
  }

  async agregarModulo(actor: Actor, courseId: string, title: string): Promise<string> {
    const curso = await this.mioEditable(actor, courseId)
    if (curso.status !== 'DRAFT' && curso.status !== 'REJECTED') {
      throw new BadRequestException('Solo puedes editar la estructura en borrador')
    }
    const existentes = await this.courses.findStructure(courseId)
    return this.courses.addModule(courseId, title, existentes.length)
  }

  async agregarLeccion(
    actor: Actor,
    courseId: string,
    moduleId: string,
    input: {
      title: string
      type: 'VIDEO' | 'TEXT'
      content: string | null
      mediaAssetId: string | null
      durationSeconds: number | null
    },
  ): Promise<string> {
    const curso = await this.mioEditable(actor, courseId)
    if (curso.status !== 'DRAFT' && curso.status !== 'REJECTED') {
      throw new BadRequestException('Solo puedes editar la estructura en borrador')
    }
    // Coherencia: una lección de texto necesita contenido; una de video, su medio.
    if (input.type === 'TEXT' && !input.content) {
      throw new BadRequestException('Una lección de texto necesita contenido')
    }
    if (input.type === 'VIDEO' && !input.mediaAssetId) {
      throw new BadRequestException('Una lección de video necesita un medio')
    }
    const estructura = await this.courses.findStructure(courseId)
    const modulo = estructura.find((m) => m.id === moduleId)
    if (!modulo) throw new NotFoundException('Módulo no encontrado en este curso')
    return this.courses.addLesson({ ...input, moduleId, orderIndex: modulo.lessons.length })
  }

  // ── Flujo de aprobación (E5) ──────────────────────────────────────────────

  /** HU-5.1 — el maestro envía su borrador a revisión: DRAFT → SUBMITTED. */
  async enviarARevision(actor: Actor, courseId: string): Promise<CourseEntity> {
    const curso = await this.mioEditable(actor, courseId)
    this.exigirTransicion(curso.status, 'SUBMITTED')

    if (!(await this.courses.hasAnyLesson(courseId))) {
      throw new BadRequestException('El curso necesita al menos una lección para enviarse')
    }

    const actualizado = await this.courses.setStatus(courseId, 'SUBMITTED')
    const evento: CourseSubmittedEvent = { courseId, teacherId: curso.teacherId }
    this.events.emit(DOMAIN_EVENTS.COURSE_SUBMITTED, evento)
    return actualizado
  }

  /** El maestro devuelve un curso rechazado a borrador para corregirlo. */
  async volverABorrador(actor: Actor, courseId: string): Promise<CourseEntity> {
    const curso = await this.mioEditable(actor, courseId)
    this.exigirTransicion(curso.status, 'DRAFT')
    return this.courses.setStatus(courseId, 'DRAFT')
  }

  /** HU-5.2 — el admin toma un curso para revisar: SUBMITTED → UNDER_REVIEW. */
  async tomarParaRevisar(actor: Actor, courseId: string): Promise<CourseEntity> {
    this.exigirAdmin(actor)
    const curso = await this.existente(courseId)
    this.exigirTransicion(curso.status, 'UNDER_REVIEW')
    return this.courses.setStatus(courseId, 'UNDER_REVIEW')
  }

  /** HU-5.2 — el admin aprueba: UNDER_REVIEW → APPROVED, auditado. */
  async aprobar(actor: Actor, courseId: string, notes: string | null): Promise<CourseEntity> {
    this.exigirAdmin(actor)
    const curso = await this.existente(courseId)
    this.exigirTransicion(curso.status, 'APPROVED')

    const actualizado = await this.courses.setStatus(courseId, 'APPROVED')
    await this.reviews.create({ courseId, reviewerId: actor.id, decision: 'APPROVED', notes })
    this.events.emit(DOMAIN_EVENTS.COURSE_REVIEWED, {
      courseId,
      teacherId: curso.teacherId,
      decision: 'APPROVED',
    })
    return actualizado
  }

  /** HU-5.2 — el admin rechaza con notas obligatorias: UNDER_REVIEW → REJECTED. */
  async rechazar(actor: Actor, courseId: string, notes: string): Promise<CourseEntity> {
    this.exigirAdmin(actor)
    if (!notes || notes.trim().length === 0) {
      throw new BadRequestException('Un rechazo necesita notas para el maestro')
    }
    const curso = await this.existente(courseId)
    this.exigirTransicion(curso.status, 'REJECTED')

    const actualizado = await this.courses.setStatus(courseId, 'REJECTED')
    await this.reviews.create({ courseId, reviewerId: actor.id, decision: 'REJECTED', notes })
    this.events.emit(DOMAIN_EVENTS.COURSE_REVIEWED, {
      courseId,
      teacherId: curso.teacherId,
      decision: 'REJECTED',
    })
    return actualizado
  }

  /** HU-5.3 — publicar un curso aprobado: APPROVED → PUBLISHED. */
  async publicar(actor: Actor, courseId: string): Promise<CourseEntity> {
    const curso = await this.existente(courseId)
    // Publica el admin, o el maestro dueño de un curso ya aprobado.
    if (actor.role !== 'ADMIN' && curso.teacherId !== actor.id) {
      throw new ForbiddenException('No puedes publicar este curso')
    }
    this.exigirTransicion(curso.status, 'PUBLISHED')

    const actualizado = await this.courses.setStatus(courseId, 'PUBLISHED')
    const evento: CoursePublishedEvent = {
      courseId,
      requiredLevelRank: curso.requiredLevelRank ?? 0,
    }
    this.events.emit(DOMAIN_EVENTS.COURSE_PUBLISHED, evento)
    return actualizado
  }

  /** Cola de cursos por revisar (SUBMITTED + UNDER_REVIEW) para el admin. */
  async colaDeRevision(actor: Actor): Promise<CourseEntity[]> {
    this.exigirAdmin(actor)
    const [enviados, enRevision] = await Promise.all([
      this.courses.findByStatus('SUBMITTED'),
      this.courses.findByStatus('UNDER_REVIEW'),
    ])
    return [...enviados, ...enRevision]
  }

  /**
   * Vista de estudiante (HU-4.4): el maestro previsualiza su curso tal como lo
   * verá el alumno, en cualquier estado (incluido DRAFT). Solo el dueño o el admin.
   */
  async vistaDeEstudiante(
    actor: Actor,
    courseId: string,
  ): Promise<{
    id: string
    title: string
    description: string | null
    status: CourseStatus
    modules: Awaited<ReturnType<CourseRepository['findStructure']>>
  }> {
    const curso = await this.existente(courseId)
    if (actor.role !== 'ADMIN' && curso.teacherId !== actor.id) {
      throw new ForbiddenException('Solo el maestro dueño puede previsualizar este curso')
    }
    return {
      id: curso.id,
      title: curso.title,
      description: curso.description,
      status: curso.status,
      modules: await this.courses.findStructure(courseId),
    }
  }

  /** Historial de decisiones de un curso (auditoría). */
  async historial(actor: Actor, courseId: string): Promise<CourseReviewEntity[]> {
    const curso = await this.existente(courseId)
    if (actor.role !== 'ADMIN' && curso.teacherId !== actor.id) {
      throw new ForbiddenException('No puedes ver el historial de este curso')
    }
    return this.reviews.findByCourse(courseId)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private exigirTransicion(from: CourseStatus, to: CourseStatus): void {
    if (!canTransition(from, to)) {
      throw new BadRequestException(`Transición inválida: ${from} → ${to}`)
    }
  }

  private exigirAdmin(actor: Actor): void {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Solo un admin puede revisar cursos')
  }

  private async existente(courseId: string): Promise<CourseEntity> {
    const curso = await this.courses.findById(courseId)
    if (!curso) throw new NotFoundException('Curso no encontrado')
    return curso
  }

  private async mioEditable(actor: Actor, courseId: string): Promise<CourseEntity> {
    const curso = await this.existente(courseId)
    if (!puedeEditarRecurso(actor, { ownerId: curso.teacherId })) {
      throw new ForbiddenException('Solo el maestro dueño puede modificar este curso')
    }
    return curso
  }

  private async slugUnico(title: string): Promise<string> {
    const base =
      title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // quita diacríticos
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'curso'
    let slug = base
    let n = 1
    while (await this.courses.slugExists(slug)) {
      slug = `${base}-${++n}`
    }
    return slug
  }
}
