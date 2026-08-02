import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { FeedService } from '../application/feed.service'
import {
  CurrentUser,
  Public,
  type CurrentUserContext,
  Roles,
  RolesGuard,
  ZodValidationPipe,
} from '../../shared'

const PublicarSchema = z.object({
  mediaAssetId: z.string().uuid(),
  caption: z.string().max(500).nullable().default(null),
  // Ficha del lienzo (HU-3.3). Opcional: una tarjeta puede publicarse solo con
  // su medio, y el cliente completa lo que falte.
  title: z.string().max(120).nullable().default(null),
  manifesto: z.string().max(280).nullable().default(null),
  story: z.string().max(4000).nullable().default(null),
  origin: z.string().max(120).nullable().default(null),
  reference: z.string().max(120).nullable().default(null),
  audioAssetId: z.string().uuid().nullable().default(null),
})

const EstadoSchema = z.object({ status: z.enum(['PUBLISHED', 'HIDDEN']) })

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role, levelRank: u.levelRank })

@ApiTags('feed')
@ApiBearerAuth()
@Controller('feed')
@UseGuards(RolesGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  // La landing y el catálogo pueden leer solo la colección ya publicada. La
  // consulta de repositorio excluye HIDDEN/REPORTED, assets no READY y filas
  // sin fecha de publicación; las rutas de escritura y administración siguen
  // protegidas por el guard global y sus roles.
  @Public()
  @ApiOperation({ summary: 'Feed vertical de Tarjetas de Fe (HU-3.1)' })
  async listar(@Query('before') before?: string) {
    const cursor = before ? new Date(before) : null
    return this.feed.feed(20, cursor && !Number.isNaN(cursor.getTime()) ? cursor : null)
  }

  @Post()
  // El servicio siempre admitió a los dos roles (Q-2); el guard dejaba fuera al
  // admin, que ahora publica desde el módulo Contenido.
  @Roles('MAESTRO', 'ADMIN')
  @ApiOperation({ summary: 'Publicar una Tarjeta de Fe (HU-3.3, MAESTRO/ADMIN)' })
  async publicar(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(PublicarSchema)) body: z.infer<typeof PublicarSchema>,
  ) {
    return this.feed.publicar(actorDe(u), body)
  }

  // ── Administración de contenido (solo ADMIN) ──────────────────────────────

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Todas las tarjetas, en cualquier estado (módulo Contenido)' })
  async listarParaAdmin(@CurrentUser() u: CurrentUserContext) {
    return this.feed.listarParaAdmin(actorDe(u))
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Publicar u ocultar una tarjeta (módulo Contenido)' })
  async cambiarEstado(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EstadoSchema)) body: z.infer<typeof EstadoSchema>,
  ) {
    return this.feed.cambiarEstado(actorDe(u), id, body.status)
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar una tarjeta y su medio (módulo Contenido)' })
  async eliminar(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    await this.feed.eliminar(actorDe(u), id)
    return { ok: true }
  }
}
