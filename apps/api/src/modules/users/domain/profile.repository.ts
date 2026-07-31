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
  /** Última consulta por chat (null si solo está inscrito en un curso). */
  lastActivityAt: Date | null
  /** true si consultó por chat; false si solo está inscrito en un curso. */
  haConsultado: boolean
  /** Cursos del maestro en los que este estudiante está inscrito. */
  courses: { id: string; title: string }[]
}

export interface LevelEntity {
  id: string
  name: string
  rank: number
  description: string | null
}

/** Métricas de la plataforma para el dashboard del ADMIN (HU-7.1). */
export interface PlatformStats {
  total: number
  /** Altas por semana (últimas 8), para ver cuánta gente entró a la plataforma. */
  signups: { periodo: string; nuevos: number }[]
  /** Usuarios con acceso en los últimos 7 / 30 días (auth.users.last_sign_in_at). */
  activos7: number
  activos30: number
  /** Composición por rol. */
  porRol: { rol: Role; total: number }[]
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

  /** Métricas de crecimiento y actividad de la plataforma (ADMIN). */
  abstract platformStats(): Promise<PlatformStats>
}
