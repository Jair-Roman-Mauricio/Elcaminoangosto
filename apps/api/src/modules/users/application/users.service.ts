import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DOMAIN_EVENTS, type Role, type UserLevelChangedEvent } from '@elcamino/shared-types'
import { ProfileRepository, type ProfileEntity } from '../domain/profile.repository'
import { puedeEditarRecurso, type Actor } from '../../shared'

/**
 * API pública del bounded context `users`.
 * Es el ÚNICO punto por el que otros módulos pueden pedir datos de perfil.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly events: EventEmitter2,
  ) {}

  async obtenerPerfil(id: string): Promise<ProfileEntity> {
    const perfil = await this.profiles.findById(id)
    if (!perfil) throw new NotFoundException('Perfil no encontrado')
    return perfil
  }

  /** `null` si el usuario aún no tiene fila en `profiles`. Usado por el guard. */
  async buscarPerfil(id: string): Promise<ProfileEntity | null> {
    return this.profiles.findById(id)
  }

  /** HU-1.1 — solo el dueño (o un admin) edita el perfil. */
  async actualizarPerfil(
    actor: Actor,
    perfilId: string,
    cambios: Partial<Pick<ProfileEntity, 'displayName' | 'bio' | 'avatarUrl'>>,
  ): Promise<ProfileEntity> {
    if (!puedeEditarRecurso(actor, { ownerId: perfilId })) {
      throw new ForbiddenException('Solo puedes editar tu propio perfil')
    }
    return this.profiles.updateProfile(perfilId, cambios)
  }

  /** HU-1.2 — cambio de rol. La restricción a ADMIN la impone `RolesGuard`. */
  async asignarRol(perfilId: string, role: Role): Promise<ProfileEntity> {
    return this.profiles.updateRole(perfilId, role)
  }

  /**
   * HU-6.2 — reacción a `LevelUpRequestApproved`.
   * Sube el nivel y anuncia el cambio para que `discipleship` recalcule el catálogo.
   */
  async cambiarNivel(perfilId: string, levelId: string): Promise<ProfileEntity> {
    const antes = await this.obtenerPerfil(perfilId)
    const despues = await this.profiles.updateLevel(perfilId, levelId)

    const evento: UserLevelChangedEvent = {
      userId: perfilId,
      fromLevelRank: antes.levelRank,
      toLevelRank: despues.levelRank,
    }
    this.events.emit(DOMAIN_EVENTS.USER_LEVEL_CHANGED, evento)

    return despues
  }
}
