import type { Role } from '@elcamino/shared-types'

/** Entidad de dominio. TypeScript puro: sin Nest, sin Drizzle. */
export interface ProfileEntity {
  id: string
  role: Role
  displayName: string
  avatarUrl: string | null
  bio: string | null
  currentLevelId: string | null
  /** `rank` del nivel actual. 0 si aún no tiene nivel. */
  levelRank: number
}

/**
 * Puerto. La implementación (adaptador Drizzle) vive en `infrastructure/`.
 * El dominio depende de esta interfaz, nunca al revés.
 */
export abstract class ProfileRepository {
  abstract findById(id: string): Promise<ProfileEntity | null>
  abstract updateProfile(
    id: string,
    cambios: Partial<Pick<ProfileEntity, 'displayName' | 'bio' | 'avatarUrl'>>,
  ): Promise<ProfileEntity>
  abstract updateRole(id: string, role: Role): Promise<ProfileEntity>
  abstract updateLevel(id: string, levelId: string): Promise<ProfileEntity>
}
