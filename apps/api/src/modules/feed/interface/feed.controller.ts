import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { FeedService } from '../application/feed.service'
import {
  CurrentUser,
  type CurrentUserContext,
  Roles,
  RolesGuard,
  ZodValidationPipe,
} from '../../shared'

const PublicarSchema = z.object({
  mediaAssetId: z.string().uuid(),
  caption: z.string().max(500).nullable().default(null),
})

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role, levelRank: u.levelRank })

@ApiTags('feed')
@ApiBearerAuth()
@Controller('feed')
@UseGuards(RolesGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  @ApiOperation({ summary: 'Feed vertical de Tarjetas de Fe (HU-3.1)' })
  async listar(@Query('before') before?: string) {
    const cursor = before ? new Date(before) : null
    return this.feed.feed(20, cursor && !Number.isNaN(cursor.getTime()) ? cursor : null)
  }

  @Post()
  @Roles('MAESTRO')
  @ApiOperation({ summary: 'Publicar una Tarjeta de Fe (HU-3.3, MAESTRO/ADMIN)' })
  async publicar(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(PublicarSchema)) body: z.infer<typeof PublicarSchema>,
  ) {
    return this.feed.publicar(actorDe(u), body)
  }
}
