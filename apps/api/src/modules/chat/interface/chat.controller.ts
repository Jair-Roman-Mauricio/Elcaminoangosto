import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ChatService } from '../application/chat.service'
import {
  CurrentUser,
  type CurrentUserContext,
  RolesGuard,
  ZodValidationPipe,
} from '../../shared'

const AbrirSchema = z.object({ otherId: z.string().uuid() })
const EnviarSchema = z.object({ body: z.string().min(1).max(4000) })

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role, levelRank: u.levelRank })

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(RolesGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('contacts')
  @ApiOperation({ summary: 'Personas con las que puedo conversar' })
  async contactos(@CurrentUser() u: CurrentUserContext) {
    return this.chat.contactos(actorDe(u))
  }

  @Get('administrators')
  @ApiOperation({ summary: 'Administradores con los que el profesor puede conversar' })
  async administradores(@CurrentUser() u: CurrentUserContext) {
    return this.chat.administradores(actorDe(u))
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Mis conversaciones con último mensaje' })
  async conversaciones(@CurrentUser() u: CurrentUserContext) {
    return this.chat.conversaciones(actorDe(u))
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Abrir (o crear) la conversación con alguien' })
  async abrir(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(AbrirSchema)) body: { otherId: string },
  ) {
    return this.chat.abrir(actorDe(u), body.otherId)
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Mensajes de una conversación' })
  async mensajes(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    return this.chat.mensajes(actorDe(u), id)
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Enviar un mensaje' })
  async enviar(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EnviarSchema)) body: { body: string },
  ) {
    return this.chat.enviar(actorDe(u), id, body.body)
  }
}
