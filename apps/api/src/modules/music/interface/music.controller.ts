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

const FavoritaSchema = z.object({ favorita: z.boolean() })
const AlbumPersonalSchema = z.object({ titulo: z.string().min(1).max(120) })
const EditarAlbumPersonalSchema = z.object({
  titulo: z.string().min(1).max(120),
  coverUrl: z.string().max(500).nullable().default(null),
  songIds: z.array(z.string().uuid()).max(500).default([]),
})

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role, levelRank: u.levelRank })

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

  // ── Favoritos (exigen cuenta) ─────────────────────────────────────────────

  @Get('favorites')
  @ApiOperation({ summary: 'Mis canciones favoritas y mis álbumes personales' })
  async misFavoritos(@CurrentUser() u: CurrentUserContext) {
    return this.music.misFavoritos(actorDe(u))
  }

  @Patch('songs/:id/favorite')
  @ApiOperation({ summary: 'Marcar o desmarcar una canción como favorita' })
  async marcarFavorita(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FavoritaSchema)) body: z.infer<typeof FavoritaSchema>,
  ) {
    await this.music.marcarCancion(actorDe(u), id, body.favorita)
    return { ok: true }
  }

  @Post('my-albums')
  @ApiOperation({ summary: 'Crear un álbum personal' })
  async crearAlbumPersonal(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(AlbumPersonalSchema)) body: z.infer<typeof AlbumPersonalSchema>,
  ) {
    return this.music.crearAlbumPersonal(actorDe(u), body.titulo)
  }

  @Patch('my-albums/:id')
  @ApiOperation({ summary: 'Editar un álbum personal' })
  async editarAlbumPersonal(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditarAlbumPersonalSchema))
    body: z.infer<typeof EditarAlbumPersonalSchema>,
  ) {
    return this.music.editarAlbumPersonal(actorDe(u), id, body)
  }

  @Delete('my-albums/:id')
  @ApiOperation({ summary: 'Eliminar un álbum personal' })
  async eliminarAlbumPersonal(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    await this.music.eliminarAlbumPersonal(actorDe(u), id)
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
