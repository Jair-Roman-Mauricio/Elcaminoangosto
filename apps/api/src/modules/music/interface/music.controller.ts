import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { MusicService } from '../application/music.service'
import {
  CurrentUser,
  Public,
  type CurrentUserContext,
  Roles,
  RolesGuard,
  ZodValidationPipe,
} from '../../shared'

const TonoSchema = z.enum(['vino', 'marfil', 'azul'])

const AlbumSchema = z.object({
  title: z.string().min(2).max(120),
  artistName: z.string().min(1).max(120),
  number: z.string().max(10).nullable().default(null),
  description: z.string().max(500).nullable().default(null),
  coverImageUrl: z.string().url().max(500).nullable().default(null),
  tone: TonoSchema.default('vino'),
  discColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color hexadecimal, p. ej. #111114')
    .nullable()
    .default(null),
})

const CancionSchema = z.object({
  title: z.string().min(2).max(160),
  artistName: z.string().min(1).max(120),
  albumId: z.string().uuid().nullable().default(null),
  subtitle: z.string().max(200).nullable().default(null),
  trackNumber: z.number().int().positive().max(999).nullable().default(null),
  audioAssetId: z.string().uuid(),
  durationSeconds: z.number().int().positive().nullable().default(null),
  tone: TonoSchema.default('vino'),
  /** Fondo de imagen: URL pública ya subida. */
  backgroundUrl: z.string().url().max(500).nullable().default(null),
  /** Fondo de video: medio ya subido por el pipeline. */
  backgroundAssetId: z.string().uuid().nullable().default(null),
  backgroundType: z.enum(['imagen', 'video']).nullable().default(null),
  /** Contenido del `.srt`, no su URL. */
  subtitlesSrt: z.string().max(200_000).nullable().default(null),
})

const EditarAlbumSchema = z.object({
  title: AlbumSchema.shape.title.optional(),
  number: AlbumSchema.shape.number.optional(),
  description: AlbumSchema.shape.description.optional(),
  coverImageUrl: AlbumSchema.shape.coverImageUrl.optional(),
  tone: TonoSchema.optional(),
  discColor: AlbumSchema.shape.discColor.optional(),
})

const PublicarSchema = z.object({ isPublished: z.boolean() })

// El código viaja siempre en el cuerpo: en la URL acabaría en los registros
// del servidor y en el historial del navegador.
const CodigoSchema = z.object({ codigo: z.string().min(6).max(64) })
// Sin código: es el primer álbum y el servidor abre la colección.
const CrearAlbumSchema = z.object({
  codigo: z.string().min(6).max(64).nullish(),
  titulo: z.string().min(1).max(120),
})
const MarcarSchema = CodigoSchema.extend({ favorita: z.boolean() })
const EditarAlbumDeColeccionSchema = CodigoSchema.extend({
  titulo: z.string().min(1).max(120),
  coverUrl: z.string().max(500).nullable().default(null),
  songIds: z.array(z.string().uuid()).max(500).default([]),
})

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role })

@ApiTags('music')
@ApiBearerAuth()
@Controller('music')
@UseGuards(RolesGuard)
export class MusicController {
  constructor(private readonly music: MusicService) {}

  @Get('catalog')
  @Public()
  @ApiOperation({ summary: 'Catálogo de Alabanza: álbumes y canciones publicadas (HU-9.2)' })
  async catalogo() {
    return this.music.catalogo()
  }

  // ── Colecciones: guardar sin cuenta ──────────────────────────────────────
  //
  // Rutas públicas: la llave es el código, no una sesión. Va en el cuerpo y
  // nunca en la URL, que acaba escrita en los registros del servidor.

  @Post('collections')
  @Public()
  @ApiOperation({ summary: 'Abrir una colección nueva y recibir su código' })
  async crearColeccion() {
    return this.music.crearColeccion()
  }

  @Post('collections/open')
  @Public()
  @ApiOperation({ summary: 'Recuperar una colección a partir de su código' })
  async abrirColeccion(
    @Body(new ZodValidationPipe(CodigoSchema)) body: z.infer<typeof CodigoSchema>,
  ) {
    return this.music.abrirColeccion(body.codigo)
  }

  @Post('collections/songs/:id')
  @Public()
  @ApiOperation({ summary: 'Marcar o desmarcar una canción en mi colección' })
  async marcarFavorita(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MarcarSchema)) body: z.infer<typeof MarcarSchema>,
  ) {
    await this.music.marcarCancion(body.codigo, id, body.favorita)
    return { ok: true }
  }

  @Post('collections/albums')
  @Public()
  @ApiOperation({ summary: 'Crear un álbum en mi colección' })
  async crearAlbumPersonal(
    @Body(new ZodValidationPipe(CrearAlbumSchema)) body: z.infer<typeof CrearAlbumSchema>,
  ) {
    return this.music.crearAlbumPersonal(body.titulo, body.codigo)
  }

  @Patch('collections/albums/:id')
  @Public()
  @ApiOperation({ summary: 'Editar un álbum de mi colección' })
  async editarAlbumPersonal(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditarAlbumDeColeccionSchema))
    body: z.infer<typeof EditarAlbumDeColeccionSchema>,
  ) {
    const { codigo, ...cambios } = body
    return this.music.editarAlbumPersonal(codigo, id, cambios)
  }

  @Post('collections/albums/:id/delete')
  @Public()
  @ApiOperation({ summary: 'Eliminar un álbum de mi colección' })
  async eliminarAlbumPersonal(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CodigoSchema)) body: z.infer<typeof CodigoSchema>,
  ) {
    await this.music.eliminarAlbumPersonal(body.codigo, id)
    return { ok: true }
  }

  // ── Administración de contenido (solo ADMIN) ──────────────────────────────

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Álbumes y todas las canciones (módulo Contenido)' })
  async listarParaAdmin(@CurrentUser() u: CurrentUserContext) {
    return this.music.listarParaAdmin(actorDe(u))
  }

  @Post('albums')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear un álbum (módulo Contenido)' })
  async crearAlbum(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(AlbumSchema)) body: z.infer<typeof AlbumSchema>,
  ) {
    return this.music.crearAlbum(actorDe(u), body)
  }

  @Patch('albums/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Editar un álbum (módulo Contenido)' })
  async editarAlbum(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditarAlbumSchema)) body: z.infer<typeof EditarAlbumSchema>,
  ) {
    return this.music.editarAlbum(actorDe(u), id, body)
  }

  @Delete('albums/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar un álbum vacío (módulo Contenido)' })
  async eliminarAlbum(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    await this.music.eliminarAlbum(actorDe(u), id)
    return { ok: true }
  }

  @Post('songs')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Subir una canción (módulo Contenido)' })
  async crearCancion(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(CancionSchema)) body: z.infer<typeof CancionSchema>,
  ) {
    return this.music.crearCancion(actorDe(u), body)
  }

  @Patch('songs/:id/published')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Publicar o retirar una canción (módulo Contenido)' })
  async publicarCancion(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PublicarSchema)) body: z.infer<typeof PublicarSchema>,
  ) {
    return this.music.publicarCancion(actorDe(u), id, body.isPublished)
  }

  @Delete('songs/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar una canción y su audio (módulo Contenido)' })
  async eliminarCancion(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    await this.music.eliminarCancion(actorDe(u), id)
    return { ok: true }
  }
}
