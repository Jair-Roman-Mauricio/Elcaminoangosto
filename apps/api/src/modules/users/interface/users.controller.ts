import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { RoleSchema, UpdateProfileSchema, type Role } from '@elcamino/shared-types'
import { UsersService } from '../application/users.service'
import {
  CurrentUser,
  type CurrentUserContext,
  Roles,
  RolesGuard,
  ZodValidationPipe,
} from '../../shared'

const AsignarRolSchema = z.object({ role: RoleSchema })

const CrearCuentaSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  displayName: z.string().min(1).max(60),
  role: RoleSchema,
})

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
      cambios as Partial<{ displayName: string; avatarUrl: string | null; bio: string | null }>,
    )
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar usuarios (HU-1.2, solo ADMIN)' })
  async listar() {
    return this.users.listarTodos()
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear una cuenta con rol (HU-1.2, solo ADMIN)' })
  async crearCuenta(
    @Body(new ZodValidationPipe(CrearCuentaSchema)) body: z.infer<typeof CrearCuentaSchema>,
  ) {
    return this.users.crearCuenta({ ...body, email: body.email.trim().toLowerCase() })
  }

  @Get('levels')
  @ApiOperation({ summary: 'Catálogo de niveles' })
  async niveles() {
    return this.users.niveles()
  }

  @Get('my-students')
  @Roles('MAESTRO')
  @ApiOperation({ summary: 'Mis estudiantes y su nivel (HU-1.3, MAESTRO)' })
  async misEstudiantes(@CurrentUser() user: CurrentUserContext) {
    return this.users.misEstudiantes(user.id)
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
