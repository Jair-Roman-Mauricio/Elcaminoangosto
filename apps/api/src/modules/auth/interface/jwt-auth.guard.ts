import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { TokenService } from '../infrastructure/token-service'
import { UsersService } from '../../users'
import { IS_PUBLIC_KEY } from '../../shared/decorators/roles.decorator'
import type { CurrentUserContext } from '../../shared/decorators/current-user.decorator'

/**
 * Guard global de autenticación.
 *
 * 1. Extrae el `Bearer` del header.
 * 2. Verifica el JWT firmado por este mismo API.
 * 3. Carga el perfil (rol) y lo adjunta a `request.user`.
 *
 * Depende de `users` solo por su **servicio público**, nunca por su repositorio.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const request = context.switchToHttp().getRequest<Request & { user?: CurrentUserContext }>()
    const token = extraerBearer(request.headers.authorization)

    // En una ruta pública la sesión es opcional: si viene un token válido se
    // adjunta el usuario —así el contenido abierto puede saber quién mira sin
    // exigirlo— y si no viene, o no sirve, se sigue como visitante anónimo.
    // Nunca se responde 401 aquí: la ruta es pública por decisión explícita.
    if (esPublica) {
      if (token) await this.adjuntarUsuario(request, token).catch(() => undefined)
      return true
    }

    if (!token) throw new UnauthorizedException('Falta el token de autenticación')
    await this.adjuntarUsuario(request, token)
    return true
  }

  /** Verifica el token y deja el perfil en `request.user`. */
  private async adjuntarUsuario(
    request: Request & { user?: CurrentUserContext },
    token: string,
  ): Promise<void> {
    const claims = await this.tokens.verificar(token)

    const perfil = await this.users.buscarPerfil(claims.sub)
    if (!perfil) throw new ForbiddenException('Tu cuenta aún no tiene perfil asociado')

    request.user = {
      id: perfil.id,
      email: claims.email ?? null,
      role: perfil.role,
    }
  }
}

function extraerBearer(header: string | undefined): string | null {
  if (!header) return null
  const [esquema, valor] = header.split(' ')
  if (esquema?.toLowerCase() !== 'bearer' || !valor) return null
  return valor
}
