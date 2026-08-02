import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { CurrentUserContext } from './current-user.decorator'

/**
 * Usuario de una ruta **pública**: el perfil si la petición traía una sesión
 * válida, o `null` si es un visitante anónimo.
 *
 * A diferencia de `@CurrentUser()`, aquí la ausencia de sesión es un caso
 * legítimo, no un error de programación.
 */
export const UsuarioOpcional = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserContext | null => {
    const request = ctx.switchToHttp().getRequest<{ user?: CurrentUserContext }>()
    return request.user ?? null
  },
)
