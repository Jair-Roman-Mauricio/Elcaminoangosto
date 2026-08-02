import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { DOMAIN_EVENTS, type Role } from '@elcamino/shared-types'
import { UsersService } from './users.service'
import {
  ProfileRepository,
  type LevelEntity,
  type ProfileEntity,
} from '../domain/profile.repository'
import { AuthAdminPort } from '../domain/auth-admin.port'

/* Repos en memoria: prueban las reglas sin base de datos. */

const NIVELES: LevelEntity[] = [
  { id: 'n1', name: 'Nuevo en el camino', rank: 1, description: null },
  { id: 'n2', name: 'Creciendo', rank: 2, description: null },
  { id: 'n3', name: 'Discipulando', rank: 3, description: null },
]

const nuevoPerfil = (over: Partial<ProfileEntity> & { id: string }): ProfileEntity => ({
  role: 'ESTUDIANTE',
  displayName: 'Persona',
  avatarUrl: null,
  bio: null,
  currentLevelId: 'n1',
  levelRank: 1,
  ...over,
})

/**
 * Cada consulta devuelve una copia, como el adaptador Drizzle: si devolviera la
 * fila viva, quien guarda un «antes» vería también el «después» y las
 * comparaciones del servicio dejarían de significar nada.
 */
class FakeProfileRepo extends ProfileRepository {
  perfiles = new Map<string, ProfileEntity>()

  seed(p: ProfileEntity) {
    this.perfiles.set(p.id, p)
    return p
  }
  async findById(id: string) {
    const perfil = this.perfiles.get(id)
    return perfil ? { ...perfil } : null
  }
  async updateLevel(id: string, levelId: string) {
    const perfil = this.perfiles.get(id)!
    perfil.currentLevelId = levelId
    perfil.levelRank = NIVELES.find((n) => n.id === levelId)?.rank ?? 0
    return { ...perfil }
  }
  async findLevels() {
    return NIVELES
  }
  async updateRole(id: string, role: Role) {
    const perfil = this.perfiles.get(id)!
    perfil.role = role
    return { ...perfil }
  }
  // No usados en estos tests:
  async updateProfile(id: string) {
    return { ...this.perfiles.get(id)! }
  }
  async findMentees() {
    return []
  }
  async findAll() {
    return [...this.perfiles.values()]
  }
  async findAdminIds() {
    return []
  }
  async platformStats() {
    return { total: 0, signups: [], activos7: 0, activos30: 0, porRol: [] }
  }
}

class FakeAuthAdmin extends AuthAdminPort {
  async createUser() {
    return 'nuevo-id'
  }
}

let perfiles: FakeProfileRepo
let events: EventEmitter2
let svc: UsersService

beforeEach(() => {
  perfiles = new FakeProfileRepo()
  events = new EventEmitter2()
  svc = new UsersService(perfiles, new FakeAuthAdmin(), events)
})

describe('el admin asigna el nivel de un estudiante (HU-1.2)', () => {
  it('sube el nivel y anuncia el cambio para que se recalcule el catálogo', async () => {
    const spy = vi.fn()
    events.on(DOMAIN_EVENTS.USER_LEVEL_CHANGED, spy)
    perfiles.seed(nuevoPerfil({ id: 'e1' }))

    const actualizado = await svc.asignarNivel('e1', 'n3')

    expect(actualizado.currentLevelId).toBe('n3')
    expect(actualizado.levelRank).toBe(3)
    expect(spy).toHaveBeenCalledWith({ userId: 'e1', fromLevelRank: 1, toLevelRank: 3 })
  })

  it('también baja de nivel: la corrección de un error no es solo hacia arriba', async () => {
    perfiles.seed(nuevoPerfil({ id: 'e1', currentLevelId: 'n3', levelRank: 3 }))

    expect((await svc.asignarNivel('e1', 'n1')).levelRank).toBe(1)
  })

  it('asignar el nivel que ya tiene no cambia nada ni emite evento', async () => {
    const spy = vi.fn()
    events.on(DOMAIN_EVENTS.USER_LEVEL_CHANGED, spy)
    perfiles.seed(nuevoPerfil({ id: 'e1', currentLevelId: 'n2', levelRank: 2 }))

    expect((await svc.asignarNivel('e1', 'n2')).levelRank).toBe(2)
    expect(spy).not.toHaveBeenCalled()
  })

  it('un maestro no tiene nivel: no se le puede asignar', async () => {
    perfiles.seed(nuevoPerfil({ id: 'm1', role: 'MAESTRO' }))

    await expect(svc.asignarNivel('m1', 'n2')).rejects.toThrow(BadRequestException)
  })

  it('rechaza un nivel que no existe en el catálogo', async () => {
    perfiles.seed(nuevoPerfil({ id: 'e1' }))

    await expect(svc.asignarNivel('e1', 'n-inventado')).rejects.toThrow(NotFoundException)
  })

  it('rechaza un perfil que no existe', async () => {
    await expect(svc.asignarNivel('fantasma', 'n2')).rejects.toThrow(NotFoundException)
  })
})
