import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { RoleSchema, UpdateProfileSchema, type Role } from '@elcamino/shared-types'

const AsignarRolSchema = z.object({ role: RoleSchema })
import { UsersService } from '../application/users.service'
import { CurrentUser, type CurrentUserContext } from '../../shared/decorators/current-user.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'
import { RolesGuard } from '../../shared/guards/roles.guard'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  async yo(@CurrentUser() user: CurrentUserContext) {
    return this.users.obtenerPerfil(user.id)
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar mi perfil (HU-1.1)' })
  async actualizarme(
    @CurrentUser() user: CurrentUserContext,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) cambios: unknown,
  ) {
    return this.users.actualizarPerfil(
      { id: user.id, role: user.role, levelRank: user.levelRank },
      user.id,
      cambios as Partial<{ displayName: string; bio: string | null }>,
    )
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Asignar rol a un usuario (HU-1.2, solo ADMIN)' })
  async asignarRol(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AsignarRolSchema)) body: { role: Role },
  ) {
    return this.users.asignarRol(id, body.role)
  }
}
