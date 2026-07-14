import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DOMAIN_EVENTS, type Role, type UserLevelChangedEvent } from '@elcamino/shared-types'
import {
  ProfileRepository,
  type ProfileEntity,
  type MenteeEntity,
  type LevelEntity,
} from '../domain/profile.repository'
import { AuthAdminPort } from '../domain/auth-admin.port'
import { puedeEditarRecurso, type Actor } from '../../shared'

/**
 * API pública del bounded context `users`.
 * Es el ÚNICO punto por el que otros módulos pueden pedir datos de perfil.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly authAdmin: AuthAdminPort,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * HU-1.2 — el ADMIN crea una cuenta con un rol (p. ej. un MAESTRO). Crea la
   * identidad en Auth (ya confirmada); el trigger inserta el perfil como
   * ESTUDIANTE y aquí se ajusta al rol pedido. La restricción a ADMIN la impone
   * `RolesGuard`.
   */
  async crearCuenta(input: {
    email: string
    password: string
    displayName: string
    role: Role
  }): Promise<ProfileEntity> {
    const userId = await this.authAdmin.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
    })
    // El nombre viaja en user_metadata, pero lo fijamos también en el perfil
    // por si el trigger usó el prefijo del correo.
    await this.profiles.updateProfile(userId, { displayName: input.displayName })
    return this.profiles.updateRole(userId, input.role)
  }

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

  /** HU-1.3 — estudiantes bajo la mentoría de este maestro. */
  async misEstudiantes(mentorId: string): Promise<MenteeEntity[]> {
    return this.profiles.findMentees(mentorId)
  }

  /** HU-1.2 — todos los usuarios, para el panel del ADMIN. */
  async listarTodos(): Promise<ProfileEntity[]> {
    return this.profiles.findAll()
  }

  /** Ids de los administradores, para notificarles eventos de gobernanza. */
  async idsDeAdmins(): Promise<string[]> {
    return this.profiles.findAdminIds()
  }

  /** Catálogo de niveles (para el catálogo del estudiante y el panel admin). */
  async niveles(): Promise<LevelEntity[]> {
    return this.profiles.findLevels()
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
