import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { LessonTypeSchema, PreguntaExamenSchema } from '@elcamino/shared-types'
import { CourseAuthoringService } from '../application/course-authoring.service'
import {
  CurrentUser,
  type CurrentUserContext,
  Roles,
  RolesGuard,
  ZodValidationPipe,
} from '../../shared'

const CrearCursoSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).nullable().default(null),
  requiredLevelId: z.string().uuid().nullable().default(null),
  isFree: z.boolean().default(true),
  plannedModules: z.number().int().nonnegative().default(0),
})

const EditarCursoSchema = CrearCursoSchema.partial().extend({
  learningObjectives: z.array(z.string().min(1).max(200)).max(12).optional(),
  purpose: z.string().max(2000).nullable().optional(),
  coverImageUrl: z.string().url().max(500).nullable().optional(),
})
const ModuloSchema = z.object({ title: z.string().min(1).max(120) })
const LeccionSchema = z.object({
  title: z.string().min(1).max(120),
  type: LessonTypeSchema,
  content: z.string().nullable().default(null),
  mediaAssetId: z.string().uuid().nullable().default(null),
  questions: z.array(PreguntaExamenSchema).max(20).default([]),
  durationSeconds: z.number().int().nonnegative().nullable().default(null),
})
const NotasSchema = z.object({ notes: z.string().max(2000).nullable().default(null) })
const LlaveSchema = z.object({ code: z.string().min(1).max(40) })
const ObservacionSchema = z.object({
  resourceType: z.enum(['LESSON', 'MODULE', 'DESCRIPTION', 'PURPOSE', 'OBJECTIVES', 'COVER', 'COURSE']),
  resourceId: z.string().uuid().nullable().default(null),
  note: z.string().min(1).max(2000),
})
const ModerarSchema = z.object({ status: z.enum(['APPROVED', 'PENDING', 'BLOCKED']) })
const BloquearSchema = z.object({ blocked: z.boolean() })
const RechazoSchema = z.object({
  notes: z.string().min(1).max(2000),
  /** Lecciones marcadas para corregir; se eliminan (con su video). */
  lessonIds: z.array(z.string().uuid()).optional(),
  /** Rechazar y borrar TODOS los contenidos de una vez. */
  borrarTodo: z.boolean().optional(),
})

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role, levelRank: u.levelRank })

@ApiTags('discipleship · authoring')
@ApiBearerAuth()
@Controller('discipleship')
@UseGuards(RolesGuard)
export class CourseAuthoringController {
  constructor(private readonly authoring: CourseAuthoringService) {}

  // ── Maestro ─────────────────────────────────────────────────────────────

  @Get('my-courses')
  @Roles('MAESTRO')
  @ApiOperation({ summary: 'Mis cursos, en cualquier estado (HU-4.3)' })
  async misCursos(@CurrentUser() u: CurrentUserContext) {
    return this.authoring.misCursos(u.id)
  }

  @Get('course-completions')
  @Roles('MAESTRO')
  @ApiOperation({ summary: 'Inscritos y completados por curso (HU-1.3)' })
  async completitudDeCursos(@CurrentUser() u: CurrentUserContext) {
    return this.authoring.completitudDeCursos(u.id)
  }

  @Post('courses')
  @Roles('MAESTRO')
  @ApiOperation({ summary: 'Crear un borrador de curso (HU-4.3)' })
  async crear(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(CrearCursoSchema)) body: z.infer<typeof CrearCursoSchema>,
  ) {
    return this.authoring.crearBorrador(actorDe(u), body)
  }

  @Patch('courses/:id')
  @Roles('MAESTRO')
  @ApiOperation({ summary: 'Editar un borrador (HU-4.3)' })
  async editar(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditarCursoSchema)) body: z.infer<typeof EditarCursoSchema>,
  ) {
    return this.authoring.editarBorrador(actorDe(u), id, body)
  }

  @Post('courses/:id/modules')
  @Roles('MAESTRO')
  @ApiOperation({ summary: 'Añadir un módulo' })
  async agregarModulo(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ModuloSchema)) body: { title: string },
  ) {
    const moduleId = await this.authoring.agregarModulo(actorDe(u), id, body.title)
    return { moduleId }
  }

  @Post('courses/:id/modules/:moduleId/lessons')
  @Roles('MAESTRO')
  @ApiOperation({ summary: 'Añadir una lección a un módulo' })
  async agregarLeccion(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Body(new ZodValidationPipe(LeccionSchema)) body: z.infer<typeof LeccionSchema>,
  ) {
    const lessonId = await this.authoring.agregarLeccion(actorDe(u), id, moduleId, body)
    return { lessonId }
  }

  @Post('courses/:id/submit')
  @Roles('MAESTRO')
  @ApiOperation({ summary: 'Enviar el curso a revisión (HU-5.1)' })
  async enviar(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    return this.authoring.enviarARevision(actorDe(u), id)
  }

  @Post('courses/:id/back-to-draft')
  @Roles('MAESTRO')
  @ApiOperation({ summary: 'Devolver un curso rechazado a borrador' })
  async volverABorrador(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    return this.authoring.volverABorrador(actorDe(u), id)
  }

  @Post('courses/:id/publish-with-key')
  @Roles('MAESTRO')
  @ApiOperation({ summary: 'Publicar un borrador con una llave del admin (sin revisión)' })
  async publicarConLlave(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(LlaveSchema)) body: { code: string },
  ) {
    return this.authoring.publicarConLlave(actorDe(u), id, body.code)
  }

  @Post('publish-keys')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Generar una llave de publicación (admin)' })
  async generarLlave(@CurrentUser() u: CurrentUserContext) {
    return this.authoring.generarLlave(actorDe(u))
  }

  @Get('publish-keys')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar las llaves de publicación (admin)' })
  async listarLlaves(@CurrentUser() u: CurrentUserContext) {
    return this.authoring.listarLlaves(actorDe(u))
  }

  @Post('courses/:id/publish')
  @ApiOperation({ summary: 'Publicar un curso aprobado (HU-5.3)' })
  async publicar(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    return this.authoring.publicar(actorDe(u), id)
  }

  @Get('courses/:id/student-view')
  @ApiOperation({ summary: 'Previsualizar el curso como estudiante (HU-4.4)' })
  async vistaEstudiante(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    return this.authoring.vistaDeEstudiante(actorDe(u), id)
  }

  @Get('courses/:id/reviews')
  @ApiOperation({ summary: 'Historial de decisiones del curso (auditoría)' })
  async historial(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    return this.authoring.historial(actorDe(u), id)
  }

  // ── Admin ───────────────────────────────────────────────────────────────

  @Get('review-queue')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Cola de cursos por revisar (HU-5.2)' })
  async cola(@CurrentUser() u: CurrentUserContext) {
    return this.authoring.colaDeRevision(actorDe(u))
  }

  @Post('courses/:id/take-review')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Tomar un curso para revisar: SUBMITTED → UNDER_REVIEW (HU-5.2)' })
  async tomar(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    return this.authoring.tomarParaRevisar(actorDe(u), id)
  }

  @Post('courses/:id/approve')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Aprobar un curso (HU-5.2)' })
  async aprobar(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(NotasSchema)) body: { notes: string | null },
  ) {
    return this.authoring.aprobar(actorDe(u), id, body.notes)
  }

  @Post('courses/:id/reject')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rechazar un curso con notas (HU-5.2)' })
  async rechazar(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RechazoSchema)) body: z.infer<typeof RechazoSchema>,
  ) {
    return this.authoring.rechazar(actorDe(u), id, body)
  }

  // ── Indicaciones de revisión (HU-5.2) ─────────────────────────────────────

  @Post('courses/:id/observations')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Dejar una indicación de cambio en un recurso (HU-5.2)' })
  async crearIndicacion(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ObservacionSchema)) body: z.infer<typeof ObservacionSchema>,
  ) {
    return this.authoring.crearIndicacion(u.id, id, body)
  }

  @Get('courses/:id/observations')
  @Roles('ADMIN', 'MAESTRO')
  @ApiOperation({ summary: 'Indicaciones de un curso (admin o maestro dueño) (HU-5.2)' })
  async indicaciones(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    return this.authoring.indicaciones(actorDe(u), id)
  }

  @Delete('observations/:obsId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Retirar una indicación (HU-5.2)' })
  async borrarIndicacion(@Param('obsId') obsId: string) {
    await this.authoring.borrarIndicacion(obsId)
    return { ok: true }
  }

  // ── Moderación de cursos publicados (HU-7.2) ──────────────────────────────

  @Get('moderation')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Cursos publicados con contenido pendiente/bloqueado (HU-7.2)' })
  async colaDeModeracion(@CurrentUser() u: CurrentUserContext) {
    return this.authoring.colaDeModeracion(actorDe(u))
  }

  @Post('lessons/:id/moderate')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Aprobar o bloquear un contenido (HU-7.2)' })
  async moderarLeccion(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ModerarSchema)) body: z.infer<typeof ModerarSchema>,
  ) {
    return this.authoring.moderarLeccion(actorDe(u), id, body.status)
  }

  @Post('courses/:id/block')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Bloquear o reactivar un curso publicado (HU-7.2)' })
  async bloquearCurso(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(BloquearSchema)) body: z.infer<typeof BloquearSchema>,
  ) {
    return this.authoring.bloquearCurso(actorDe(u), id, body.blocked)
  }

  @Get('courses/:id/moderation-log')
  @Roles('ADMIN', 'MAESTRO')
  @ApiOperation({ summary: 'Bitácora de moderación del curso (admin o maestro dueño) (HU-7.2)' })
  async bitacoraDeModeracion(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    return this.authoring.bitacoraDeModeracion(actorDe(u), id)
  }
}
