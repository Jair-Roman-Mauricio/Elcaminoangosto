import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { VideosService } from '../application/videos.service'
import {
  CurrentUser,
  Public,
  type CurrentUserContext,
  Roles,
  RolesGuard,
  UsuarioOpcional,
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
/**
 * El identificador del autor lo genera el navegador y es aleatorio. Se limita
 * su forma para que no se cuele nada con significado —un correo, un nombre— en
 * un campo que acaba siendo la identidad de quien escribe.
 */
const AutorSchema = z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/, 'Identificador de autor inválido')

const ComentarioSchema = z.object({
  cuerpo: z.string().trim().min(1).max(320),
  autorId: AutorSchema,
})

const OcultarSchema = z.object({ oculto: z.boolean() })

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

  @Get(':id/comments')
  @Public()
  @ApiOperation({ summary: 'Comentarios de un video' })
  async comentarios(
    @UsuarioOpcional() usuario: CurrentUserContext | null,
    @Param('id') id: string,
  ) {
    return this.videos.comentarios(usuario ? { id: usuario.id, role: usuario.role } : null, id)
  }

  // Comentar no exige cuenta: no hay cuentas que exigir. Quien escribe manda un
  // identificador aleatorio de su navegador y el servicio aplica el límite.
  @Post(':id/comments')
  @Public()
  @ApiOperation({ summary: 'Comentar un video' })
  async comentar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ComentarioSchema)) body: z.infer<typeof ComentarioSchema>,
  ) {
    return this.videos.comentar({ videoId: id, ...body })
  }

  @Patch('comments/:id/hidden')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ocultar o mostrar un comentario' })
  async ocultarComentario(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(OcultarSchema)) body: z.infer<typeof OcultarSchema>,
  ) {
    await this.videos.ocultarComentario({ id: u.id, role: u.role }, id, body.oculto)
    return { ok: true }
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
