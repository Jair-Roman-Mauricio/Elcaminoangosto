import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { JwksVerifier } from '../infrastructure/jwks-verifier'
import { UsersService } from '../../users'
import { IS_PUBLIC_KEY } from '../../shared/decorators/roles.decorator'
import type { CurrentUserContext } from '../../shared/decorators/current-user.decorator'

/**
 * Guard global de autenticación (HU-0.2).
 *
 * 1. Extrae el `Bearer` del header.
 * 2. Lo verifica contra el JWKS asimétrico de Supabase.
 * 3. Carga el perfil (rol + nivel) y lo adjunta a `request.user`.
 *
 * Depende de `users` solo por su **servicio público**, nunca por su repositorio.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwksVerifier,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (esPublica) return true

    const request = context.switchToHttp().getRequest<Request & { user?: CurrentUserContext }>()
    const token = extraerBearer(request.headers.authorization)
    if (!token) throw new UnauthorizedException('Falta el token de autenticación')

    const claims = await this.verifier.verify(token)

    const perfil = await this.users.buscarPerfil(claims.sub)
    if (!perfil) {
      // El JWT es válido pero no hay fila en `profiles`: el trigger de
      // aprovisionamiento no corrió. No es un 401 (el token es bueno).
      throw new ForbiddenException('Tu cuenta aún no tiene perfil asociado')
    }

    request.user = {
      id: perfil.id,
      email: claims.email ?? null,
      role: perfil.role,
      levelRank: perfil.levelRank,
    }

    return true
  }
}

function extraerBearer(header: string | undefined): string | null {
  if (!header) return null
  const [esquema, valor] = header.split(' ')
  if (esquema?.toLowerCase() !== 'bearer' || !valor) return null
  return valor
}
