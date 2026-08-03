import type { Role } from '@elcamino/shared-types'

/**
 * Perfil de una cuenta.
 *
 * Quedó al mínimo cuando desaparecieron alumnos y profesores: sin niveles que
 * asignar, sin mentorías que resolver y sin roles que repartir. En la práctica
 * solo lo tiene la cuenta de administración.
 */
export interface ProfileEntity {
  id: string
  role: Role
  displayName: string
  avatarUrl: string | null
  bio: string | null
}

export abstract class ProfileRepository {
  abstract findById(id: string): Promise<ProfileEntity | null>

  abstract updateProfile(
    id: string,
    cambios: Partial<Pick<ProfileEntity, 'displayName' | 'bio' | 'avatarUrl'>>,
  ): Promise<ProfileEntity>
}
