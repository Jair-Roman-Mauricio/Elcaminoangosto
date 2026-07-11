import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { LessonTypeSchema } from '@elcamino/shared-types'
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

const EditarCursoSchema = CrearCursoSchema.partial()
const ModuloSchema = z.object({ title: z.string().min(1).max(120) })
const LeccionSchema = z.object({
  title: z.string().min(1).max(120),
  type: LessonTypeSchema,
  content: z.string().nullable().default(null),
  mediaAssetId: z.string().uuid().nullable().default(null),
  durationSeconds: z.number().int().nonnegative().nullable().default(null),
})
const NotasSchema = z.object({ notes: z.string().max(2000).nullable().default(null) })
const RechazoSchema = z.object({ notes: z.string().min(1).max(2000) })

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
    @Body(new ZodValidationPipe(RechazoSchema)) body: { notes: string },
  ) {
    return this.authoring.rechazar(actorDe(u), id, body.notes)
  }
}
