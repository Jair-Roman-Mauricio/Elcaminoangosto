import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { NotificationsService } from '../application/notifications.service'
import { CurrentUser, type CurrentUserContext, RolesGuard } from '../../shared'

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Mis notificaciones' })
  async listar(@CurrentUser() u: CurrentUserContext) {
    return this.notifications.listar(u.id)
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Nº de notificaciones sin leer' })
  async noLeidas(@CurrentUser() u: CurrentUserContext) {
    return { count: await this.notifications.contarNoLeidas(u.id) }
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  async marcarLeida(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    await this.notifications.marcarLeida(u.id, id)
    return { ok: true }
  }
}
