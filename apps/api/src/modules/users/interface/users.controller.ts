import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UpdateProfileSchema } from '@elcamino/shared-types'
import { UsersService } from '../application/users.service'
import { CurrentUser, type CurrentUserContext, ZodValidationPipe } from '../../shared'

/**
 * Solo el perfil propio. La gestión de cuentas, roles y niveles desapareció
 * con los alumnos y los profesores: ahora únicamente entra el admin.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil de la cuenta autenticada' })
  async yo(@CurrentUser() user: CurrentUserContext) {
    return this.users.obtenerPerfil(user.id)
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar mi perfil' })
  async actualizarme(
    @CurrentUser() user: CurrentUserContext,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) cambios: unknown,
  ) {
    return this.users.actualizarPerfil(
      user.id,
      cambios as Partial<{ displayName: string; avatarUrl: string | null; bio: string | null }>,
    )
  }
}
