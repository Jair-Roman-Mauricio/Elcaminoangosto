import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { AnalyticsService } from '../application/analytics.service'
import {
  CurrentUser,
  type CurrentUserContext,
  Public,
  Roles,
  RolesGuard,
  UsuarioOpcional,
  ZodValidationPipe,
} from '../../shared'

const TipoSchema = z.enum(['VIDEO', 'POST', 'SONG', 'LECTURA', 'ORACION'])

/**
 * El identificador de sesión lo genera el cliente y es aleatorio. Se limita su
 * forma para que no se cuele nada con significado (un correo, un id de usuario).
 */
const SesionSchema = z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/, 'Identificador de sesión inválido')

const VistaSchema = z.object({
  kind: TipoSchema,
  contentId: z.string().uuid(),
  sessionId: SesionSchema,
})

const VisitaSchema = z.object({
  section: z.string().min(1).max(60),
  sessionId: SesionSchema,
})

const PeriodoSchema = z.object({
  dias: z.coerce.number().int().min(1).max(365).default(30),
  busqueda: z.string().max(120).optional(),
  limite: z.coerce.number().int().min(1).max(100).optional(),
  kind: TipoSchema.optional(),
  /** «vistas» cuenta reproducciones; «visitantes», sesiones distintas. */
  orden: z.enum(['vistas', 'visitantes']).optional(),
})

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role })

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  // ── Registro (abierto: hay que poder medir a quien aún no tiene cuenta) ───

  @Post('views')
  @Public()
  @HttpCode(204)
  @ApiOperation({ summary: 'Registra la vista de un contenido público' })
  async registrarVista(
    @UsuarioOpcional() usuario: CurrentUserContext | null,
    @Body(new ZodValidationPipe(VistaSchema)) body: z.infer<typeof VistaSchema>,
  ): Promise<void> {
    await this.analytics.registrarVista({ ...body, viewerId: usuario?.id ?? null })
  }

  @Post('visits')
  @Public()
  @HttpCode(204)
  @ApiOperation({ summary: 'Registra la entrada a una sección' })
  async registrarVisita(
    @UsuarioOpcional() usuario: CurrentUserContext | null,
    @Body(new ZodValidationPipe(VisitaSchema)) body: z.infer<typeof VisitaSchema>,
  ): Promise<void> {
    await this.analytics.registrarVisita({ ...body, viewerId: usuario?.id ?? null })
  }

  // ── Informes (solo ADMIN) ─────────────────────────────────────────────────

  @Get('most-viewed')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Lo más visto de un tipo, con búsqueda por título' })
  async masVistos(
    @CurrentUser() u: CurrentUserContext,
    @Query(new ZodValidationPipe(PeriodoSchema)) q: z.infer<typeof PeriodoSchema>,
  ) {
    return this.analytics.masVistos(actorDe(u), {
      kind: q.kind ?? 'VIDEO',
      dias: q.dias,
      busqueda: q.busqueda ?? null,
      ...(q.orden === undefined ? {} : { orden: q.orden }),
      ...(q.limite === undefined ? {} : { limite: q.limite }),
    })
  }

  @Get('top-albums')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Álbumes por escuchas acumuladas de sus canciones' })
  async albumes(
    @CurrentUser() u: CurrentUserContext,
    @Query(new ZodValidationPipe(PeriodoSchema)) q: z.infer<typeof PeriodoSchema>,
  ) {
    return this.analytics.albumesMasEscuchados(actorDe(u), {
      dias: q.dias,
      busqueda: q.busqueda ?? null,
      ...(q.limite === undefined ? {} : { limite: q.limite }),
    })
  }

  @Get('visitors')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Flujo de visitantes, con y sin cuenta' })
  async visitantes(
    @CurrentUser() u: CurrentUserContext,
    @Query(new ZodValidationPipe(PeriodoSchema)) q: z.infer<typeof PeriodoSchema>,
  ) {
    return this.analytics.flujoDeVisitantes(actorDe(u), q.dias)
  }
}
