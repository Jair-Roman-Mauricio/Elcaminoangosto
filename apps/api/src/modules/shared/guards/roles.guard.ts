import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Role } from '@elcamino/shared-types'
import { ROLES_KEY } from '../decorators/roles.decorator'
import type { CurrentUserContext } from '../decorators/current-user.decorator'

/**
 * Autorización por rol (RBAC). Primera mitad de la regla de oro:
 * *el rol define capacidades*.
 *
 * Corre DESPUÉS de `SupabaseAuthGuard`, que ya puso `request.user`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // Sin @Roles(), la ruta no impone restricción de rol.
    if (!required || required.length === 0) return true

    const { user } = context.switchToHttp().getRequest<{ user?: CurrentUserContext }>()
    if (!user) throw new ForbiddenException('Sin contexto de usuario')

    // El ADMIN tiene control absoluto (contexto.md §4.3).
    if (user.role === 'ADMIN') return true

    if (!required.includes(user.role)) {
      throw new ForbiddenException('Tu rol no permite esta acción')
    }
    return true
  }
}
