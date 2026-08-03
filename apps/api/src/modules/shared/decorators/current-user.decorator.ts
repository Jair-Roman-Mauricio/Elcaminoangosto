import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Role } from '@elcamino/shared-types'

/** Usuario autenticado, adjuntado a la request por `SupabaseAuthGuard`. */
export interface CurrentUserContext {
  /** `sub` del JWT = `auth.users.id` = `profiles.id`. */
  id: string
  email: string | null
  role: Role
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserContext => {
    const request = ctx.switchToHttp().getRequest<{ user?: CurrentUserContext }>()
    if (!request.user) {
      // Ocurre si se usa @CurrentUser() en una ruta @Public(). Es un bug de programación.
      throw new Error('@CurrentUser() usado en una ruta sin SupabaseAuthGuard')
    }
    return request.user
  },
)
