import { Body, Controller, Get, Headers, Param, Post, Put, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { BucketSchema, MediaKindSchema } from '@elcamino/shared-types'
import { MediaService } from '../application/media.service'
import {
  CurrentUser,
  type CurrentUserContext,
  RolesGuard,
  ZodValidationPipe,
} from '../../shared'

const CrearSubidaSchema = z.object({ kind: MediaKindSchema, bucket: BucketSchema })

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role })

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
@UseGuards(RolesGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('uploads')
  @ApiOperation({ summary: 'Reservar un asset para subida reanudable (HU-8.1)' })
  async crearSubida(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(CrearSubidaSchema)) body: z.infer<typeof CrearSubidaSchema>,
  ) {
    return this.media.crearSubida(actorDe(u), body)
  }

  @Put('uploads/:id/content')
  @ApiOperation({ summary: 'Subir el contenido (cuerpo binario) de un asset reservado' })
  async subir(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('content-type') contentType: string | undefined,
    @Headers('content-length') longitud: string | undefined,
  ) {
    await this.media.subirContenido(actorDe(u), id, req, contentType ?? '', numeroOIndefinido(longitud))
    return { ok: true }
  }

  @Put('images')
  @ApiOperation({ summary: 'Subir una imagen a un bucket público; devuelve su URL permanente' })
  async subirImagen(
    @CurrentUser() u: CurrentUserContext,
    @Req() req: Request,
    @Headers('content-type') contentType: string | undefined,
    @Headers('content-length') longitud: string | undefined,
  ) {
    return this.media.subirImagenPublica(actorDe(u), req, contentType ?? '', numeroOIndefinido(longitud))
  }

  @Post('uploads/:id/process')
  @ApiOperation({ summary: 'Avisar de subida completa y encolar transcodificación (HU-8.2)' })
  async procesar(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    await this.media.encolarProcesamiento(actorDe(u), id)
    return { ok: true }
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Estado de procesamiento del asset' })
  async estado(@Param('id') id: string) {
    const a = await this.media.estado(id)
    return { id: a.id, status: a.status, posterPath: a.posterPath }
  }
}

function numeroOIndefinido(v: string | undefined): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}
