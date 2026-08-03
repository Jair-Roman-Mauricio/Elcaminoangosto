import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Delete } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CommunityService } from '../application/community.service'
import {
  CurrentUser,
  type CurrentUserContext,
  Public,
  Roles,
  RolesGuard,
  UsuarioOpcional,
  ZodValidationPipe,
} from '../../shared'

/**
 * El identificador del autor lo genera el navegador y es aleatorio. Se limita
 * su forma para que no se cuele nada con significado —un correo, un nombre— en
 * un campo que acaba siendo la identidad de quien escribe.
 */
const AutorSchema = z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/, 'Identificador de autor inválido')

const AbrirHiloSchema = z.object({
  titulo: z.string().min(5).max(140),
  cuerpo: z.string().min(10).max(5000),
  autorId: AutorSchema,
})

const ResponderSchema = z.object({
  cuerpo: z.string().min(2).max(5000),
  autorId: AutorSchema,
})

const ListarSchema = z.object({
  busqueda: z.string().max(120).optional(),
  limite: z.coerce.number().int().min(1).max(50).optional(),
})

const OcultarSchema = z.object({ oculto: z.boolean() })

const actorDe = (u: CurrentUserContext | null) => (u ? { id: u.id, role: u.role } : null)

@ApiTags('community')
@ApiBearerAuth()
@Controller('community')
@UseGuards(RolesGuard)
export class CommunityController {
  constructor(private readonly comunidad: CommunityService) {}

  // ── Abierto: la comunidad es de todos, con cuenta o sin ella ──────────────

  @Get('threads')
  @Public()
  @ApiOperation({ summary: 'Hilos, del de actividad más reciente al más antiguo' })
  async listar(
    @UsuarioOpcional() usuario: CurrentUserContext | null,
    @Query(new ZodValidationPipe(ListarSchema)) q: z.infer<typeof ListarSchema>,
  ) {
    return this.comunidad.listarHilos(actorDe(usuario), {
      busqueda: q.busqueda ?? null,
      ...(q.limite === undefined ? {} : { limite: q.limite }),
    })
  }

  @Get('threads/:id')
  @Public()
  @ApiOperation({ summary: 'Un hilo con sus respuestas' })
  async ver(
    @UsuarioOpcional() usuario: CurrentUserContext | null,
    @Param('id') id: string,
  ) {
    return this.comunidad.verHilo(actorDe(usuario), id)
  }

  @Post('threads')
  @Public()
  @ApiOperation({ summary: 'Abrir un hilo' })
  async abrir(@Body(new ZodValidationPipe(AbrirHiloSchema)) body: z.infer<typeof AbrirHiloSchema>) {
    return this.comunidad.abrirHilo(body)
  }

  @Post('threads/:id/replies')
  @Public()
  @ApiOperation({ summary: 'Responder en un hilo' })
  async responder(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ResponderSchema)) body: z.infer<typeof ResponderSchema>,
  ) {
    return this.comunidad.responder({ hiloId: id, ...body })
  }

  // ── Moderación (solo ADMIN) ───────────────────────────────────────────────

  @Patch('threads/:id/hidden')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ocultar o mostrar un hilo' })
  async ocultarHilo(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(OcultarSchema)) body: z.infer<typeof OcultarSchema>,
  ) {
    await this.comunidad.ocultarHilo({ id: u.id, role: u.role }, id, body.oculto)
    return { ok: true }
  }

  @Patch('replies/:id/hidden')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ocultar o mostrar una respuesta' })
  async ocultarRespuesta(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(OcultarSchema)) body: z.infer<typeof OcultarSchema>,
  ) {
    await this.comunidad.ocultarRespuesta({ id: u.id, role: u.role }, id, body.oculto)
    return { ok: true }
  }

  @Delete('threads/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar un hilo con sus respuestas' })
  async eliminar(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    await this.comunidad.eliminarHilo({ id: u.id, role: u.role }, id)
    return { ok: true }
  }
}
