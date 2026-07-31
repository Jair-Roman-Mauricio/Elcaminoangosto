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
  type ContentModeratedEvent,
  type CourseStatus,
  type CourseSubmittedEvent,
  type CoursePublishedEvent,
  type LessonType,
  type PreguntaExamen,
} from '@elcamino/shared-types'
import {
  CourseRepository,
  type CourseEntity,
  type ModerationStatus,
  type ObservationEntity,
  type ObservationResource,
} from '../domain/course.repository'
import {
  ModerationActionRepository,
  type ModerationAction,
  type ModerationActionEntity,
} from '../domain/moderation-action.repository'
import {
  CourseReviewRepository,
  type CourseReviewEntity,
} from '../domain/course-review.repository'
import { puedeEditarRecurso, type Actor } from '../../shared'
import { MediaService } from '../../media'
import { PublishKeyRepository, type PublishKeyEntity } from '../domain/publish-key.repository'

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
    private readonly media: MediaService,
    private readonly llaves: PublishKeyRepository,
    private readonly moderaciones: ModerationActionRepository,
  ) {}

  // ── Llaves de publicación (excepción autorizada por el admin, ver ADR) ──────

  /** El admin genera una llave de un solo uso para dar a un maestro de confianza. */
  async generarLlave(actor: Actor): Promise<PublishKeyEntity> {
    this.exigirAdmin(actor)
    // Código legible: 3 grupos de 4 (evita 0/O, 1/I).
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const grupo = () =>
      Array.from({ length: 4 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join('')
    const code = `${grupo()}-${grupo()}-${grupo()}`
    return this.llaves.create(code, actor.id)
  }

  /** Listado de llaves para el panel del admin. */
  async listarLlaves(actor: Actor): Promise<PublishKeyEntity[]> {
    this.exigirAdmin(actor)
    return this.llaves.findAll()
  }

  /**
   * El maestro publica su borrador directamente con una llave válida, saltándose
   * la revisión. La llave la genera el admin (autorización delegada); es de un
   * solo uso. Aun así, el curso debe tener al menos una lección.
   */
  async publicarConLlave(actor: Actor, courseId: string, code: string): Promise<CourseEntity> {
    const curso = await this.mioEditable(actor, courseId)
    if (curso.status !== 'DRAFT' && curso.status !== 'REJECTED') {
      throw new BadRequestException('Solo un borrador puede publicarse con una llave')
    }
    if (!(await this.courses.hasAnyLesson(courseId))) {
      throw new BadRequestException('El curso necesita al menos una lección para publicarse')
    }
    const llave = await this.llaves.findByCode(code.trim().toUpperCase())
    if (!llave) throw new BadRequestException('El código no es válido')
    if (llave.usedAt) throw new BadRequestException('Este código ya se usó')

    await this.llaves.markUsed(llave.id, actor.id, courseId)
    const actualizado = await this.courses.setStatus(courseId, 'PUBLISHED')
    this.events.emit(DOMAIN_EVENTS.COURSE_PUBLISHED, {
      courseId,
      requiredLevelRank: curso.requiredLevelRank ?? 0,
    } satisfies CoursePublishedEvent)
    return actualizado
  }

  /**
   * URL firmada para previsualizar el video de una lección. Usa el archivo
   * original (no exige transcodificación), así el maestro lo ve al instante.
   */
  private async firmarVideo(mediaAssetId: string | null): Promise<string | null> {
    if (!mediaAssetId) return null
    try {
      return await this.media.urlDeOrigen(mediaAssetId, true)
    } catch {
      return null
    }
  }

  // ── Autoría (HU-4.3) ──────────────────────────────────────────────────────

  /** Mis cursos, en cualquier estado (para el maestro). */
  async misCursos(teacherId: string): Promise<CourseEntity[]> {
    return this.courses.findByTeacher(teacherId)
  }

  /** Inscritos y completados por curso (estadística del dashboard del maestro). */
  async completitudDeCursos(teacherId: string) {
    return this.courses.completionStatsByTeacher(teacherId)
  }

  // ── Indicaciones de revisión (HU-5.2) ──────────────────────────────────────

  /** El admin deja una indicación de cambio sobre un recurso del curso. */
  async crearIndicacion(
    adminId: string,
    courseId: string,
    input: { resourceType: ObservationResource; resourceId?: string | null; note: string },
  ): Promise<ObservationEntity> {
    const curso = await this.courses.findById(courseId)
    if (!curso) throw new NotFoundException('Curso no encontrado')
    const nota = input.note.trim()
    if (nota.length < 1) throw new ForbiddenException('La indicación no puede estar vacía')
    return this.courses.createObservation({
      courseId,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      note: nota,
      createdBy: adminId,
    })
  }

  /** Indicaciones de un curso. Las ve el admin o el maestro dueño del curso. */
  async indicaciones(actor: Actor, courseId: string): Promise<ObservationEntity[]> {
    const curso = await this.courses.findById(courseId)
    if (!curso) throw new NotFoundException('Curso no encontrado')
    if (actor.role !== 'ADMIN' && curso.teacherId !== actor.id) {
      throw new ForbiddenException('No puedes ver las indicaciones de este curso')
    }
    return this.courses.listObservations(courseId)
  }

  /** El admin retira una indicación. */
  async borrarIndicacion(id: string): Promise<void> {
    const obs = await this.courses.findObservationById(id)
    if (!obs) throw new NotFoundException('Indicación no encontrada')
    await this.courses.deleteObservation(id)
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
      learningObjectives?: string[] | undefined
      purpose?: string | null | undefined
      coverImageUrl?: string | null | undefined
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
      type: LessonType
      content: string | null
      mediaAssetId: string | null
      questions: PreguntaExamen[]
      durationSeconds: number | null
    },
  ): Promise<string> {
    const curso = await this.mioEditable(actor, courseId)
    // En borrador/rechazado se edita libremente. En un curso PUBLICADO también se
    // puede añadir contenido, pero nace PENDING y no lo ve el alumno hasta que el
    // admin lo apruebe en Moderación (HU-7.2).
    const editableLibre = curso.status === 'DRAFT' || curso.status === 'REJECTED'
    if (!editableLibre && curso.status !== 'PUBLISHED') {
      throw new BadRequestException('Solo puedes editar la estructura en borrador o publicado')
    }
    const moderationStatus = curso.status === 'PUBLISHED' ? ('PENDING' as const) : ('APPROVED' as const)
    // Coherencia según el tipo de lección.
    if (input.type === 'TEXT' && !input.content) {
      throw new BadRequestException('Una lección de texto necesita contenido')
    }
    if (input.type === 'VIDEO' && !input.mediaAssetId) {
      throw new BadRequestException('Una lección de video necesita un medio')
    }
    if (input.type === 'IMAGE' && !input.content) {
      throw new BadRequestException('Una galería necesita al menos una imagen')
    }
    if (input.type === 'EXAM') {
      if (input.questions.length === 0) {
        throw new BadRequestException('Una evaluación necesita al menos una pregunta')
      }
      for (const pregunta of input.questions) {
        if (pregunta.correcta >= pregunta.opciones.length) {
          throw new BadRequestException('Cada pregunta debe marcar una opción correcta válida')
        }
      }
    }
    const estructura = await this.courses.findStructure(courseId)
    const modulo = estructura.find((m) => m.id === moduleId)
    if (!modulo) throw new NotFoundException('Módulo no encontrado en este curso')
    return this.courses.addLesson({
      ...input,
      moduleId,
      orderIndex: modulo.lessons.length,
      moderationStatus,
    })
  }

  // ── Moderación de cursos publicados (HU-7.2) ────────────────────────────────

  /** Cursos publicados con contenido pendiente/bloqueado (cola de moderación). */
  async colaDeModeracion(actor: Actor) {
    this.exigirAdmin(actor)
    return this.courses.moderationQueue()
  }

  /**
   * El admin aprueba o bloquea un contenido concreto de un curso publicado.
   * Queda auditado en la bitácora y se notifica al maestro por evento.
   */
  async moderarLeccion(
    actor: Actor,
    lessonId: string,
    status: ModerationStatus,
  ): Promise<ModerationActionEntity> {
    this.exigirAdmin(actor)
    const leccion = await this.courses.findLessonById(lessonId)
    if (!leccion) throw new NotFoundException('Contenido no encontrado')
    if (leccion.moderationStatus === status) {
      throw new BadRequestException('El contenido ya está en ese estado')
    }
    const curso = await this.cursoDeLaLeccion(lessonId)

    await this.courses.setLessonModeration(lessonId, status)
    return this.registrarModeracion(actor, curso, `LESSON_${status}`, {
      id: leccion.id,
      title: leccion.title,
    })
  }

  /** El admin bloquea (o reactiva) un curso publicado por completo. */
  async bloquearCurso(
    actor: Actor,
    courseId: string,
    blocked: boolean,
  ): Promise<ModerationActionEntity> {
    this.exigirAdmin(actor)
    const curso = await this.existente(courseId)
    if (curso.status !== 'PUBLISHED') {
      throw new BadRequestException('Solo se modera un curso publicado')
    }
    if (curso.blocked === blocked) {
      throw new BadRequestException(
        blocked ? 'El curso ya está bloqueado' : 'El curso no está bloqueado',
      )
    }

    await this.courses.setCourseBlocked(courseId, blocked)
    return this.registrarModeracion(actor, curso, blocked ? 'COURSE_BLOCKED' : 'COURSE_UNBLOCKED')
  }

  /** Bitácora de moderación de un curso. La ven el admin y el maestro dueño. */
  async bitacoraDeModeracion(actor: Actor, courseId: string): Promise<ModerationActionEntity[]> {
    const curso = await this.existente(courseId)
    if (actor.role !== 'ADMIN' && curso.teacherId !== actor.id) {
      throw new ForbiddenException('No puedes ver la bitácora de este curso')
    }
    return this.moderaciones.findByCourse(courseId)
  }

  /** Audita la decisión y avisa al maestro (notificaciones escucha el evento). */
  private async registrarModeracion(
    actor: Actor,
    curso: CourseEntity,
    action: ModerationAction,
    leccion?: { id: string; title: string },
  ): Promise<ModerationActionEntity> {
    const registro = await this.moderaciones.create({
      courseId: curso.id,
      lessonId: leccion?.id ?? null,
      lessonTitle: leccion?.title ?? null,
      action,
      moderatorId: actor.id,
    })
    this.events.emit(DOMAIN_EVENTS.CONTENT_MODERATED, {
      courseId: curso.id,
      teacherId: curso.teacherId,
      lessonId: leccion?.id ?? null,
      action,
    } satisfies ContentModeratedEvent)
    return registro
  }

  /** El curso publicado al que pertenece una lección. */
  private async cursoDeLaLeccion(lessonId: string): Promise<CourseEntity> {
    const courseId = await this.courses.findCourseIdByLesson(lessonId)
    if (!courseId) throw new NotFoundException('Contenido sin curso')
    const curso = await this.existente(courseId)
    if (curso.status !== 'PUBLISHED') {
      throw new BadRequestException('Solo se modera el contenido de un curso publicado')
    }
    return curso
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

  /**
   * HU-5.2 — el admin rechaza con notas obligatorias: UNDER_REVIEW → REJECTED.
   *
   * Borrado de contenidos según el diseño acordado:
   * - `borrarTodo`: se eliminan TODAS las lecciones y sus videos.
   * - Segundo rechazo en adelante: también se eliminan TODAS (el maestro ya tuvo
   *   una oportunidad de corregir).
   * - Primer rechazo normal: solo se eliminan las lecciones marcadas (`lessonIds`).
   */
  async rechazar(
    actor: Actor,
    courseId: string,
    input: { notes: string; lessonIds?: string[] | undefined; borrarTodo?: boolean | undefined },
  ): Promise<CourseEntity> {
    this.exigirAdmin(actor)
    const notes = input.notes?.trim() ?? ''
    if (notes.length === 0) {
      throw new BadRequestException('Un rechazo necesita notas para el maestro')
    }
    const curso = await this.existente(courseId)
    this.exigirTransicion(curso.status, 'REJECTED')

    // ¿Es un rechazo repetido? Cuenta los rechazos previos de este curso.
    const previos = await this.reviews.findByCourse(courseId)
    const rechazosPrevios = previos.filter((r) => r.decision === 'REJECTED').length
    const borrarTodas = Boolean(input.borrarTodo) || rechazosPrevios >= 1

    const estructura = await this.courses.findStructure(courseId)
    const todas = estructura.flatMap((m) => m.lessons)
    const aBorrar = borrarTodas
      ? todas
      : todas.filter((l) => (input.lessonIds ?? []).includes(l.id))

    for (const leccion of aBorrar) {
      // La lección referencia el asset por FK: bórrala antes que el medio.
      await this.courses.deleteLesson(leccion.id)
      if (leccion.mediaAssetId) await this.media.eliminar(leccion.mediaAssetId)
    }

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
  async vistaDeEstudiante(actor: Actor, courseId: string) {
    const curso = await this.existente(courseId)
    if (actor.role !== 'ADMIN' && curso.teacherId !== actor.id) {
      throw new ForbiddenException('Solo el maestro dueño puede previsualizar este curso')
    }
    const estructura = await this.courses.findStructure(courseId)
    // Firma la URL de reproducción de cada lección de video (el maestro dueño y
    // el admin están autorizados a previsualizarla).
    const modules = await Promise.all(
      estructura.map(async (modulo) => ({
        ...modulo,
        lessons: await Promise.all(
          modulo.lessons.map(async (leccion) => ({
            ...leccion,
            videoUrl: leccion.type === 'VIDEO' ? await this.firmarVideo(leccion.mediaAssetId) : null,
          })),
        ),
      })),
    )
    return {
      id: curso.id,
      title: curso.title,
      description: curso.description,
      requiredLevelId: curso.requiredLevelId,
      requiredLevelRank: curso.requiredLevelRank,
      isFree: curso.isFree,
      plannedModules: curso.plannedModules,
      learningObjectives: curso.learningObjectives,
      purpose: curso.purpose,
      coverImageUrl: curso.coverImageUrl,
      status: curso.status,
      /** Bloqueado por moderación (HU-7.2): lo necesitan el editor y el canvas. */
      blocked: curso.blocked,
      modules,
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
