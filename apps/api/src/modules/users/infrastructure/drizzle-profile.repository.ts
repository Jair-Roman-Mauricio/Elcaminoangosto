import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, count, eq, sql } from 'drizzle-orm'
import type { Role } from '@elcamino/shared-types'
import { DRIZZLE, type Database } from '../../shared/database/database.module'
import { profiles, levels, conversations, enrollments, courses } from '../../shared/database/schema'
import {
  ProfileRepository,
  type ProfileEntity,
  type MenteeEntity,
  type LevelEntity,
  type PlatformStats,
} from '../domain/profile.repository'

const rankPredeterminado = (role: Role, rank: number | null) =>
  rank ?? (role === 'ESTUDIANTE' ? 1 : 0)

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

    return { ...fila, levelRank: rankPredeterminado(fila.role, fila.levelRank) }
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

  /**
   * Estudiantes del maestro (HU-1.3). Bajo el modelo de consulta libre, «mis
   * estudiantes» son quienes se relacionan con él: los que le escribieron por
   * chat y los inscritos en sus cursos. Se fusionan por estudiante, con los que
   * consultaron primero y por consulta más reciente.
   */
  async findMentees(mentorId: string): Promise<MenteeEntity[]> {
    const porChat = await this.db
      .select({
        studentId: profiles.id,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        levelName: levels.name,
        levelRank: levels.rank,
        lastActivityAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .innerJoin(profiles, eq(profiles.id, conversations.studentId))
      .leftJoin(levels, eq(profiles.currentLevelId, levels.id))
      // Solo estudiantes reales: el lado «student» de un chat puede ser otro
      // maestro (consulta maestro↔maestro) y ese no es un estudiante suyo.
      .where(and(eq(conversations.mentorId, mentorId), eq(profiles.role, 'ESTUDIANTE')))

    const porCurso = await this.db
      .selectDistinct({
        studentId: profiles.id,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        levelName: levels.name,
        levelRank: levels.rank,
        courseId: courses.id,
        courseTitle: courses.title,
      })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
      .leftJoin(levels, eq(profiles.currentLevelId, levels.id))
      .where(eq(courses.teacherId, mentorId))

    const porId = new Map<string, MenteeEntity>()
    const asegurar = (f: {
      studentId: string
      displayName: string
      avatarUrl: string | null
      levelName: string | null
      levelRank: number | null
    }): MenteeEntity => {
      const existente = porId.get(f.studentId)
      if (existente) return existente
      const nuevo: MenteeEntity = {
        studentId: f.studentId,
        displayName: f.displayName,
        avatarUrl: f.avatarUrl,
        levelName: f.levelName,
        levelRank: f.levelRank ?? 1,
        lastActivityAt: null,
        haConsultado: false,
        courses: [],
      }
      porId.set(f.studentId, nuevo)
      return nuevo
    }

    for (const f of porChat) {
      const m = asegurar(f)
      m.lastActivityAt = f.lastActivityAt
      m.haConsultado = true
    }
    for (const f of porCurso) {
      const m = asegurar(f)
      if (!m.courses.some((c) => c.id === f.courseId)) {
        m.courses.push({ id: f.courseId, title: f.courseTitle })
      }
    }
    for (const m of porId.values()) {
      m.courses.sort((a, b) => a.title.localeCompare(b.title))
    }

    return [...porId.values()].sort((a, b) => {
      const ta = a.lastActivityAt ? +new Date(a.lastActivityAt) : 0
      const tb = b.lastActivityAt ? +new Date(b.lastActivityAt) : 0
      return tb - ta || a.displayName.localeCompare(b.displayName)
    })
  }

  async findLevels(): Promise<LevelEntity[]> {
    return this.db
      .select({
        id: levels.id,
        name: levels.name,
        rank: levels.rank,
        description: levels.description,
      })
      .from(levels)
      .orderBy(asc(levels.rank))
  }

  async findAll(): Promise<ProfileEntity[]> {
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
      .orderBy(asc(profiles.displayName))

    return filas.map((f) => ({ ...f, levelRank: rankPredeterminado(f.role, f.levelRank) }))
  }

  async findAdminIds(): Promise<string[]> {
    const filas = await this.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.role, 'ADMIN'))
    return filas.map((f) => f.id)
  }

  async platformStats(): Promise<PlatformStats> {
    // Altas por semana (últimas 8), rellenando semanas sin altas con 0.
    const signupsRaw = await this.db.execute(sql`
      select to_char(wk, 'DD Mon') as periodo, count(p.id)::int as nuevos
      from generate_series(
        date_trunc('week', now()) - interval '7 weeks',
        date_trunc('week', now()),
        interval '1 week'
      ) as wk
      left join profiles p on date_trunc('week', p.created_at) = wk
      group by wk
      order by wk
    `)
    const signups = [...signupsRaw].map((r) => ({
      periodo: String((r as { periodo: string }).periodo),
      nuevos: Number((r as { nuevos: number }).nuevos),
    }))

    // Usuarios que accedieron (auth.users.last_sign_in_at) en 7 / 30 días.
    const activosRaw = await this.db.execute(sql`
      select
        count(*) filter (where last_sign_in_at >= now() - interval '7 days')::int as a7,
        count(*) filter (where last_sign_in_at >= now() - interval '30 days')::int as a30
      from auth.users
    `)
    const activos = [...activosRaw][0] as { a7: number; a30: number } | undefined

    const roles = await this.db
      .select({ rol: profiles.role, total: count() })
      .from(profiles)
      .groupBy(profiles.role)

    const total = roles.reduce((s, r) => s + Number(r.total), 0)

    return {
      total,
      signups,
      activos7: Number(activos?.a7 ?? 0),
      activos30: Number(activos?.a30 ?? 0),
      porRol: roles.map((r) => ({ rol: r.rol, total: Number(r.total) })),
    }
  }

  private async findByIdOrThrow(id: string): Promise<ProfileEntity> {
    const perfil = await this.findById(id)
    if (!perfil) throw new NotFoundException('Perfil no encontrado')
    return perfil
  }
}
