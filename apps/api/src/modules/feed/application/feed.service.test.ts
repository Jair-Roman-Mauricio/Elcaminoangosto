import { describe, it, expect, beforeEach } from 'vitest'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { FeedService } from './feed.service'
import {
  PostRepository,
  type AdminPostEntity,
  type PostEntity,
  type PostStatus,
} from '../domain/post.repository'

/* Repos en memoria: prueban las reglas de administración sin base de datos. */

const nuevaTarjeta = (over: Partial<PostEntity> & { id: string }): PostEntity => ({
  authorId: 'm1',
  type: 'VIDEO',
  mediaAssetId: `asset-${over.id}`,
  caption: null,
  status: 'PUBLISHED',
  ...over,
})

class FakePostRepo extends PostRepository {
  tarjetas = new Map<string, PostEntity>()
  borradas: string[] = []

  seed(p: PostEntity) {
    this.tarjetas.set(p.id, p)
    return p
  }
  async findById(id: string) {
    const p = this.tarjetas.get(id)
    return p ? { ...p } : null
  }
  async updateStatus(id: string, status: PostStatus) {
    const p = this.tarjetas.get(id)!
    p.status = status
    return { ...p }
  }
  async remove(id: string) {
    this.borradas.push(id)
    this.tarjetas.delete(id)
  }
  async findAllForAdmin(): Promise<AdminPostEntity[]> {
    return [...this.tarjetas.values()].map((p) => ({
      id: p.id,
      authorId: p.authorId,
      authorName: 'Marcos',
      type: p.type,
      caption: p.caption,
      status: p.status,
      mediaAssetId: p.mediaAssetId,
      mediaStatus: 'READY',
      publishedAt: new Date(),
      createdAt: new Date(),
    }))
  }
  // No usados en estos tests:
  async create() {
    return nuevaTarjeta({ id: 'nueva' })
  }
  async findFeed() {
    return []
  }
}

/** Fake de MediaService: registra los medios eliminados y firma pósters. */
class FakeMedia {
  eliminados: string[] = []
  async eliminar(assetId: string) {
    this.eliminados.push(assetId)
  }
  async urlDePoster(assetId: string) {
    return `https://firmada/${assetId}.jpg`
  }
}

const admin = { id: 'a1', role: 'ADMIN' as const, levelRank: 0 }
const maestro = { id: 'm1', role: 'MAESTRO' as const, levelRank: 0 }

let posts: FakePostRepo
let media: FakeMedia
let svc: FeedService

beforeEach(() => {
  posts = new FakePostRepo()
  media = new FakeMedia()
  svc = new FeedService(posts, media as never, new EventEmitter2())
})

describe('administración de tarjetas (módulo Contenido)', () => {
  it('el admin ve las tarjetas ocultas, que no salen en el feed', async () => {
    posts.seed(nuevaTarjeta({ id: 't1' }))
    posts.seed(nuevaTarjeta({ id: 't2', status: 'HIDDEN' }))

    const lista = await svc.listarParaAdmin(admin)

    expect(lista.map((t) => t.id)).toEqual(['t1', 't2'])
    expect(lista[1]!.status).toBe('HIDDEN')
  })

  it('ocultar una tarjeta la retira del feed sin borrar el medio', async () => {
    posts.seed(nuevaTarjeta({ id: 't1' }))

    expect((await svc.cambiarEstado(admin, 't1', 'HIDDEN')).status).toBe('HIDDEN')
    expect(media.eliminados).toEqual([])
  })

  it('no se cambia al estado que ya tiene', async () => {
    posts.seed(nuevaTarjeta({ id: 't1', status: 'HIDDEN' }))

    await expect(svc.cambiarEstado(admin, 't1', 'HIDDEN')).rejects.toThrow(BadRequestException)
  })

  it('eliminar borra la tarjeta y después su archivo', async () => {
    posts.seed(nuevaTarjeta({ id: 't1', mediaAssetId: 'asset-1' }))

    await svc.eliminar(admin, 't1')

    expect(posts.borradas).toEqual(['t1'])
    expect(media.eliminados).toEqual(['asset-1'])
  })

  it('una tarjeta que no existe no se administra', async () => {
    await expect(svc.cambiarEstado(admin, 'fantasma', 'HIDDEN')).rejects.toThrow(NotFoundException)
    await expect(svc.eliminar(admin, 'fantasma')).rejects.toThrow(NotFoundException)
  })

  it('un maestro no administra el contenido publicado, ni el suyo', async () => {
    posts.seed(nuevaTarjeta({ id: 't1', authorId: 'm1' }))

    await expect(svc.listarParaAdmin(maestro)).rejects.toThrow(ForbiddenException)
    await expect(svc.cambiarEstado(maestro, 't1', 'HIDDEN')).rejects.toThrow(ForbiddenException)
    await expect(svc.eliminar(maestro, 't1')).rejects.toThrow(ForbiddenException)
    expect(posts.borradas).toEqual([])
  })
})
