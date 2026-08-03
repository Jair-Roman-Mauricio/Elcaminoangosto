import { Body, Controller, Delete, Get, NotImplementedException, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { VideosService } from '../application/videos.service'
import {
  CurrentUser,
  Public,
  type CurrentUserContext,
  Roles,
  RolesGuard,
  ZodValidationPipe,
} from '../../shared'

const FichaSchema = {
  title: z.string().min(2).max(120),
  series: z.string().max(120).nullable().default(null),
  description: z.string().max(2000).nullable().default(null),
  reference: z.string().max(120).nullable().default(null),
}

const PublicarSchema = z.object({ ...FichaSchema, mediaAssetId: z.string().uuid() })

const EditarSchema = z.object({
  title: FichaSchema.title.optional(),
  series: FichaSchema.series.optional(),
  description: FichaSchema.description.optional(),
  reference: FichaSchema.reference.optional(),
})

const EstadoSchema = z.object({ status: z.enum(['PUBLISHED', 'HIDDEN']) })
const ComentarioSchema = z.object({ body: z.string().trim().min(1).max(320) })

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role })

@ApiTags('videos')
@ApiBearerAuth()
@Controller('videos')
@UseGuards(RolesGuard)
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Catálogo de videos cristianos (HU-9.3)' })
  async catalogo() {
    return this.videos.catalogo()
  }

  // No hay persistencia de comentarios de video todavía. La ruta existe solo
  // para que el guard global rechace explícitamente toda escritura anónima.
  @Post(':id/comments')
  @Roles('ESTUDIANTE', 'MAESTRO', 'ADMIN')
  @ApiOperation({ summary: 'Comentarios de video (requiere sesión; persistencia pendiente)' })
  comentar(@Body(new ZodValidationPipe(ComentarioSchema)) _body: z.infer<typeof ComentarioSchema>) {
    throw new NotImplementedException('Los comentarios de video aún no están habilitados')
  }

  // ── Administración de contenido (solo ADMIN) ──────────────────────────────

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Todos los videos, en cualquier estado (módulo Contenido)' })
  async listarParaAdmin(@CurrentUser() u: CurrentUserContext) {
    return this.videos.listarParaAdmin(actorDe(u))
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Publicar un video (módulo Contenido)' })
  async publicar(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(PublicarSchema)) body: z.infer<typeof PublicarSchema>,
  ) {
    return this.videos.publicar(actorDe(u), body)
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Editar la ficha de un video (módulo Contenido)' })
  async editar(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditarSchema)) body: z.infer<typeof EditarSchema>,
  ) {
    return this.videos.editar(actorDe(u), id, body)
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Publicar u ocultar un video (módulo Contenido)' })
  async cambiarEstado(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EstadoSchema)) body: z.infer<typeof EstadoSchema>,
  ) {
    return this.videos.cambiarEstado(actorDe(u), id, body.status)
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar un video y su archivo (módulo Contenido)' })
  async eliminar(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    await this.videos.eliminar(actorDe(u), id)
    return { ok: true }
  }
}
