import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
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

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role, levelRank: u.levelRank })

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
