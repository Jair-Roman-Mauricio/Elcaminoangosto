import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { Role } from '@elcamino/shared-types'
import { DRIZZLE, type Database } from '../../shared/database/database.module'
import { profiles, levels } from '../../shared/database/schema'
import { ProfileRepository, type ProfileEntity } from '../domain/profile.repository'

/** Adaptador Drizzle del puerto `ProfileRepository`. */
@Injectable()
export class DrizzleProfileRepository extends ProfileRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async findById(id: string): Promise<ProfileEntity | null> {
    const filas = await this.db
      .select({
        id: profiles.id,
        role: profiles.role,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        bio: profiles.bio,
        currentLevelId: profiles.currentLevelId,
        levelRank: levels.rank,
      })
      .from(profiles)
      .leftJoin(levels, eq(profiles.currentLevelId, levels.id))
      .where(eq(profiles.id, id))
      .limit(1)

    const fila = filas[0]
    if (!fila) return null

    return { ...fila, levelRank: fila.levelRank ?? 0 }
  }

  async updateProfile(
    id: string,
    cambios: Partial<Pick<ProfileEntity, 'displayName' | 'bio' | 'avatarUrl'>>,
  ): Promise<ProfileEntity> {
    await this.db
      .update(profiles)
      .set({ ...cambios, updatedAt: new Date() })
      .where(eq(profiles.id, id))
    return this.findByIdOrThrow(id)
  }

  async updateRole(id: string, role: Role): Promise<ProfileEntity> {
    await this.db.update(profiles).set({ role, updatedAt: new Date() }).where(eq(profiles.id, id))
    return this.findByIdOrThrow(id)
  }

  async updateLevel(id: string, levelId: string): Promise<ProfileEntity> {
    await this.db
      .update(profiles)
      .set({ currentLevelId: levelId, updatedAt: new Date() })
      .where(eq(profiles.id, id))
    return this.findByIdOrThrow(id)
  }

  private async findByIdOrThrow(id: string): Promise<ProfileEntity> {
    const perfil = await this.findById(id)
    if (!perfil) throw new NotFoundException('Perfil no encontrado')
    return perfil
  }
}
