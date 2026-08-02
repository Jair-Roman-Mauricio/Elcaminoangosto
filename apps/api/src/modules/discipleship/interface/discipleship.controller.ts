import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { DiscipleshipService } from '../application/discipleship.service'
import {
  CurrentUser,
  type CurrentUserContext,
  Public,
  RolesGuard,
  ZodValidationPipe,
} from '../../shared'

const InscribirseSchema = z.object({ courseId: z.string().uuid() })
const CalificarSchema = z.object({ respuestas: z.array(z.number().int()).max(20) })

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role, levelRank: u.levelRank })

@ApiTags('discipleship')
@ApiBearerAuth()
@Controller('discipleship')
@UseGuards(RolesGuard)
export class DiscipleshipController {
  constructor(private readonly discipleship: DiscipleshipService) {}

  @Get('public-catalog')
  @Public()
  @ApiOperation({ summary: 'Metadatos públicos de cursos publicados, sin acceso a lecciones' })
  async catalogoPublico() {
    return this.discipleship.catalogoPublico()
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Catálogo de cursos por nivel (HU-4.1)' })
  async catalogo(@CurrentUser() user: CurrentUserContext) {
    return this.discipleship.catalogo(actorDe(user))
  }

  @Get('courses/:slug')
  @ApiOperation({ summary: 'Ficha de un curso con su estructura' })
  async ficha(@CurrentUser() user: CurrentUserContext, @Param('slug') slug: string) {
    return this.discipleship.fichaPorSlug(actorDe(user), slug)
  }

  @Post('enrollments')
  @ApiOperation({ summary: 'Inscribirse a un curso (HU-4.1)' })
  async inscribirse(
    @CurrentUser() user: CurrentUserContext,
    @Body(new ZodValidationPipe(InscribirseSchema)) body: { courseId: string },
  ) {
    return this.discipleship.inscribirse(actorDe(user), body.courseId)
  }

  @Post('lessons/:id/complete')
  @ApiOperation({ summary: 'Marcar una lección como completada (HU-4.2)' })
  async completar(@CurrentUser() user: CurrentUserContext, @Param('id') lessonId: string) {
    return this.discipleship.completarLeccion(actorDe(user), lessonId)
  }

  @Post('lessons/:id/grade')
  @ApiOperation({ summary: 'Calificar una evaluación en el servidor' })
  async calificar(
    @CurrentUser() user: CurrentUserContext,
    @Param('id') lessonId: string,
    @Body(new ZodValidationPipe(CalificarSchema)) body: { respuestas: number[] },
  ) {
    return this.discipleship.calificarEvaluacion(actorDe(user), lessonId, body.respuestas)
  }

  @Get('courses/:id/roster')
  @ApiOperation({ summary: 'Estudiantes inscritos y su progreso (HU-4.5, MAESTRO dueño)' })
  async roster(@CurrentUser() user: CurrentUserContext, @Param('id') courseId: string) {
    return this.discipleship.rosterDeCurso(actorDe(user), courseId)
  }
}
