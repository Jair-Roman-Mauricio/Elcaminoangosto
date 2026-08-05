import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { LecturasService } from '../application/lecturas.service'
import {
  CurrentUser,
  type CurrentUserContext,
  Public,
  Roles,
  RolesGuard,
  UsuarioOpcional,
  ZodValidationPipe,
} from '../../shared'

const LecturaSchema = z.object({
  titulo: z.string().trim().min(3).max(160),
  entradilla: z.string().trim().max(400).nullable().default(null),
  cuerpo: z.string().trim().min(1).max(60000),
  autor: z.string().trim().min(2).max(120),
  seccion: z.string().trim().max(80).nullable().default(null),
  referencia: z.string().trim().max(120).nullable().default(null),
  portadaAssetId: z.string().uuid().nullable().default(null),
  ilustracionAssetId: z.string().uuid().nullable().default(null),
  /** Los telones que trae la interfaz. La lista vive también en la migración. */
  fondo: z.enum(['brasas', 'vitral', 'ondas', 'polvo']).nullable().default(null),
  /**
   * Redes del artículo. Una dirección en blanco no se guarda: un icono que no
   * lleva a ninguna parte es peor que no tener el icono.
   */
  redes: z
    .record(z.string(), z.string().trim())
    .default({})
    .transform((redes) =>
      Object.fromEntries(Object.entries(redes).filter(([, url]) => url.length > 0)),
    )
    .refine(
      (redes) => Object.values(redes).every((url) => /^https:\/\/\S+$/.test(url)),
      'Las direcciones de las redes tienen que empezar por https://',
    ),
})

const ComentarioSchema = z.object({
  cuerpo: z.string().trim().min(1).max(1000),
  autorId: z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/, 'Identificador de autor inválido'),
})

const OcultarSchema = z.object({ oculto: z.boolean() })

const OracionSchema = z.object({
  titulo: z.string().trim().min(3).max(160),
  tema: z.string().trim().max(80).nullable().default(null),
  lineas: z.array(z.string()).min(1).max(200),
  marcas: z.array(z.number().nonnegative()).nullable().default(null),
  audioAssetId: z.string().uuid(),
  imagenAssetId: z.string().uuid().nullable().default(null),
  fondoAssetId: z.string().uuid().nullable().default(null),
})

const EditarLecturaSchema = LecturaSchema.partial().extend({ oculto: z.boolean().optional() })
const EditarOracionSchema = OracionSchema.partial().extend({ oculto: z.boolean().optional() })

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role })

/**
 * Devocionales y oraciones guiadas.
 *
 * Leer es público: el contenido de la plataforma no pide cuenta. Publicar,
 * editar y retirar son del ADMIN.
 */
@ApiTags('lecturas')
@ApiBearerAuth()
@Controller()
@UseGuards(RolesGuard)
export class LecturasController {
  constructor(private readonly lecturas: LecturasService) {}

  // ── Devocionales: se leen y se guardan ───────────────────────────────────

  @Get('devocionales')
  @Public()
  @ApiOperation({ summary: 'Devocionales publicados, del más nuevo al más viejo' })
  async devocionales(@UsuarioOpcional() u: CurrentUserContext | null) {
    return this.lecturas.listar(u ? actorDe(u) : null, 'DEVOCIONAL')
  }

  // ── Revista: artículos más hondos, con conversación debajo ───────────────

  @Get('revista')
  @Public()
  @ApiOperation({ summary: 'Artículos de la revista' })
  async revista(@UsuarioOpcional() u: CurrentUserContext | null) {
    return this.lecturas.listar(u ? actorDe(u) : null, 'ARTICULO')
  }

  @Get('lecturas/:id')
  @Public()
  @ApiOperation({ summary: 'Una lectura, sea devocional o artículo' })
  async lectura(@UsuarioOpcional() u: CurrentUserContext | null, @Param('id') id: string) {
    return this.lecturas.ver(u ? actorDe(u) : null, id)
  }

  @Get('lecturas/:id/relacionadas')
  @Public()
  @ApiOperation({ summary: 'Tres lecturas para seguir después de esta' })
  async relacionadas(@UsuarioOpcional() u: CurrentUserContext | null, @Param('id') id: string) {
    return this.lecturas.relacionadas(u ? actorDe(u) : null, id)
  }

  @Get('lecturas/:id/comments')
  @Public()
  @ApiOperation({ summary: 'Comentarios de un artículo' })
  async comentarios(@UsuarioOpcional() u: CurrentUserContext | null, @Param('id') id: string) {
    return this.lecturas.comentarios(u ? actorDe(u) : null, id)
  }

  @Post('lecturas/:id/comments')
  @Public()
  @ApiOperation({ summary: 'Comentar un artículo' })
  async comentar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ComentarioSchema)) body: z.infer<typeof ComentarioSchema>,
  ) {
    return this.lecturas.comentar({ lecturaId: id, ...body })
  }

  @Patch('lecturas/comments/:id/hidden')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ocultar o mostrar un comentario' })
  async ocultarComentario(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(OcultarSchema)) body: z.infer<typeof OcultarSchema>,
  ) {
    await this.lecturas.ocultarComentario(actorDe(u), id, body.oculto)
    return { ok: true }
  }

  // ── Publicación (solo ADMIN) ─────────────────────────────────────────────

  @Post('devocionales')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Publicar un devocional' })
  async publicarDevocional(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(LecturaSchema)) body: z.infer<typeof LecturaSchema>,
  ) {
    return this.lecturas.publicar(actorDe(u), { ...body, tipo: 'DEVOCIONAL' })
  }

  @Post('revista')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Publicar un artículo de revista' })
  async publicarArticulo(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(LecturaSchema)) body: z.infer<typeof LecturaSchema>,
  ) {
    return this.lecturas.publicar(actorDe(u), { ...body, tipo: 'ARTICULO' })
  }

  @Patch('lecturas/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Editar u ocultar una lectura' })
  async editarLectura(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditarLecturaSchema)) body: z.infer<typeof EditarLecturaSchema>,
  ) {
    await this.lecturas.editar(actorDe(u), id, body)
    return { ok: true }
  }

  @Delete('lecturas/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar una lectura' })
  async eliminarLectura(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    await this.lecturas.eliminar(actorDe(u), id)
    return { ok: true }
  }

  // ── Oraciones guiadas ────────────────────────────────────────────────────

  @Get('oraciones')
  @Public()
  @ApiOperation({ summary: 'Oraciones guiadas publicadas' })
  async oraciones(@UsuarioOpcional() u: CurrentUserContext | null) {
    return this.lecturas.oraciones(u ? actorDe(u) : null)
  }

  @Post('oraciones')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Publicar una oración guiada' })
  async publicarOracion(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(OracionSchema)) body: z.infer<typeof OracionSchema>,
  ) {
    return this.lecturas.publicarOracion(actorDe(u), body)
  }

  @Patch('oraciones/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Editar u ocultar una oración guiada' })
  async editarOracion(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditarOracionSchema)) body: z.infer<typeof EditarOracionSchema>,
  ) {
    await this.lecturas.editarOracion(actorDe(u), id, body)
    return { ok: true }
  }

  @Delete('oraciones/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar una oración guiada' })
  async eliminarOracion(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    await this.lecturas.eliminarOracion(actorDe(u), id)
    return { ok: true }
  }
}
