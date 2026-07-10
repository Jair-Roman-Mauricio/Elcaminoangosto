import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  SetMetadata,
  Inject,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { CurrentUserContext } from '../decorators/current-user.decorator'
import { motivoDeBloqueo, puedeEditarRecurso, type Actor } from '../domain/policies'
import { PolicyRegistry } from './policy.registry'

export const POLICY_KEY = 'policy'

export interface PolicySpec {
  /** Clave con la que el módulo dueño registró su cargador en `PolicyRegistry`. */
  resource: string
  /** Nombre del parámetro de ruta que contiene el id. Por defecto `id`. */
  param?: string
  /** `read` valida nivel o propiedad; `write` exige propiedad. */
  action: 'read' | 'write'
}

/**
 * Declara qué recurso protege esta ruta. Ej.:
 *   @Policy({ resource: 'course', action: 'write' })
 *   @Patch(':id')
 */
export const Policy = (spec: PolicySpec) => SetMetadata(POLICY_KEY, spec)

/**
 * Autorización de acceso fino (ABAC): propiedad del recurso y nivel del
 * estudiante. Segunda mitad de la regla de oro.
 *
 * No conoce ningún módulo: pide el recurso al `PolicyRegistry`, donde cada
 * bounded context registró un cargador. Así el guard nunca importa el
 * repositorio de otro módulo (AGENTS.md §4).
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PolicyRegistry) private readonly registry: PolicyRegistry,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const spec = this.reflector.getAllAndOverride<PolicySpec | undefined>(POLICY_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!spec) return true

    const request = context.switchToHttp().getRequest<{
      user?: CurrentUserContext
      params: Record<string, string>
    }>()

    const user = request.user
    if (!user) throw new ForbiddenException('Sin contexto de usuario')

    const id = request.params[spec.param ?? 'id']
    if (!id) throw new NotFoundException('Recurso no encontrado')

    const recurso = await this.registry.load(spec.resource, id)
    if (!recurso) throw new NotFoundException('Recurso no encontrado')

    const actor: Actor = { id: user.id, role: user.role, levelRank: user.levelRank }

    if (spec.action === 'write') {
      if (!puedeEditarRecurso(actor, recurso)) {
        throw new ForbiddenException('No tienes permiso sobre este recurso.')
      }
      return true
    }

    const motivo = motivoDeBloqueo(actor, recurso)
    if (motivo) throw new ForbiddenException(motivo)
    return true
  }
}
