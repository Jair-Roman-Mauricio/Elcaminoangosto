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

/** Un estudiante bajo la mentoría de un maestro (HU-1.3). */
export interface MenteeEntity {
  studentId: string
  displayName: string
  avatarUrl: string | null
  levelName: string | null
  levelRank: number
}

export interface LevelEntity {
  id: string
  name: string
  rank: number
  description: string | null
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

  /** Estudiantes activos asignados a este mentor (HU-1.3). */
  abstract findMentees(mentorId: string): Promise<MenteeEntity[]>

  /** Catálogo de niveles, ordenado por rank. */
  abstract findLevels(): Promise<LevelEntity[]>

  /** Todos los perfiles, para el panel de gestión de roles del ADMIN (HU-1.2). */
  abstract findAll(): Promise<ProfileEntity[]>

  /** Ids de los administradores, para notificarles eventos de gobernanza. */
  abstract findAdminIds(): Promise<string[]>
}
