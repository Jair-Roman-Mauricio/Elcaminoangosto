import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DRIZZLE, type Database } from '../../shared'
import { profiles } from '../../shared/database/schema'
import { ProfileRepository, type ProfileEntity } from '../domain/profile.repository'

@Injectable()
export class DrizzleProfileRepository extends ProfileRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super()
  }

  async findById(id: string): Promise<ProfileEntity | null> {
    const [fila] = await this.db.select().from(profiles).where(eq(profiles.id, id)).limit(1)
    return fila ? this.aEntidad(fila) : null
  }

  async updateProfile(
    id: string,
    cambios: Partial<Pick<ProfileEntity, 'displayName' | 'bio' | 'avatarUrl'>>,
  ): Promise<ProfileEntity> {
    const [fila] = await this.db
      .update(profiles)
      .set({
        ...(cambios.displayName === undefined ? {} : { displayName: cambios.displayName }),
        ...(cambios.bio === undefined ? {} : { bio: cambios.bio }),
        ...(cambios.avatarUrl === undefined ? {} : { avatarUrl: cambios.avatarUrl }),
      })
      .where(eq(profiles.id, id))
      .returning()
    return this.aEntidad(fila!)
  }

  private aEntidad(f: typeof profiles.$inferSelect): ProfileEntity {
    return {
      id: f.id,
      role: f.role,
      displayName: f.displayName,
      avatarUrl: f.avatarUrl,
      bio: f.bio,
    }
  }
}
