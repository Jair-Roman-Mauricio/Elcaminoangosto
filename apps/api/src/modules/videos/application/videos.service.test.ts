import { describe, it, expect, beforeEach } from 'vitest'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { VideosService } from './videos.service'
import {
  VideoRepository,
  type VideoConMedioEntity,
  type VideoEntity,
  type VideoStatus,
} from '../domain/video.repository'

/* Repos en memoria: prueban las reglas sin base de datos. */

const nuevoVideo = (over: Partial<VideoEntity> & { id: string }): VideoEntity => ({
  title: 'Bienaventurados',
  series: null,
  description: null,
  reference: null,
  mediaAssetId: `asset-${over.id}`,
  status: 'PUBLISHED',
  createdBy: 'a1',
  publishedAt: new Date(),
  createdAt: new Date(),
  ...over,
})

class FakeVideoRepo extends VideoRepository {
  videos = new Map<string, VideoEntity>()
  borrados: string[] = []

  seed(v: VideoEntity) {
    this.videos.set(v.id, v)
    return v
  }
  async findById(id: string) {
    const v = this.videos.get(id)
    return v ? { ...v } : null
  }
  async create(input: Parameters<VideoRepository['create']>[0]) {
    const v = nuevoVideo({ id: `v${this.videos.size + 1}`, ...input })
    this.videos.set(v.id, v)
    return { ...v }
  }
  async update(id: string, cambios: Parameters<VideoRepository['update']>[1]) {
    const v = this.videos.get(id)!
    Object.assign(v, cambios)
    return { ...v }
  }
  async updateStatus(id: string, status: VideoStatus) {
    const v = this.videos.get(id)!
    v.status = status
    return { ...v }
  }
  async remove(id: string) {
    this.borrados.push(id)
    this.videos.delete(id)
  }
  async findPublished(): Promise<VideoConMedioEntity[]> {
    return this.conMedio((v) => v.status === 'PUBLISHED')
  }
  async findAll(): Promise<VideoConMedioEntity[]> {
    return this.conMedio(() => true)
  }
  private conMedio(filtro: (v: VideoEntity) => boolean): VideoConMedioEntity[] {
    return [...this.videos.values()]
      .filter(filtro)
      .map((v) => ({ ...v, mediaStatus: 'READY', authorName: 'Ana Admin' }))
  }
}

/** Fake de MediaService: firma URLs y registra los medios eliminados. */
class FakeMedia {
  eliminados: string[] = []
  assets = new Map<string, { ownerId: string; kind: string }>()

  async estado(assetId: string) {
    const asset = this.assets.get(assetId)
    if (!asset) throw new NotFoundException('Medio no encontrado')
    return asset
  }
  async eliminar(assetId: string) {
    this.eliminados.push(assetId)
  }
  async urlDeLectura(assetId: string) {
    return `https://firmada/${assetId}.mp4`
  }
  async urlDePoster(assetId: string) {
    return `https://firmada/${assetId}.jpg`
  }
}

const admin = { id: 'a1', role: 'ADMIN' as const, levelRank: 0 }
const maestro = { id: 'm1', role: 'MAESTRO' as const, levelRank: 0 }

let videos: FakeVideoRepo
let media: FakeMedia
let svc: VideosService

beforeEach(() => {
  videos = new FakeVideoRepo()
  media = new FakeMedia()
  media.assets.set('asset-video', { ownerId: 'a1', kind: 'VIDEO' })
  media.assets.set('asset-imagen', { ownerId: 'a1', kind: 'IMAGE' })
  media.assets.set('asset-ajeno', { ownerId: 'otro', kind: 'VIDEO' })
  svc = new VideosService(videos, media as never)
})

const fichaMinima = {
  title: 'Bienaventurados',
  series: null,
  description: null,
  reference: null,
}

describe('catálogo de videos (HU-9.3)', () => {
  it('solo muestra los publicados, con las URLs firmadas', async () => {
    videos.seed(nuevoVideo({ id: 'v1' }))
    videos.seed(nuevoVideo({ id: 'v2', status: 'HIDDEN' }))

    const catalogo = await svc.catalogo()

    expect(catalogo.map((v) => v.id)).toEqual(['v1'])
    expect(catalogo[0]!.mediaUrl).toContain('firmada')
  })
})

describe('administración de videos (módulo Contenido)', () => {
  it('publica un video con su ficha', async () => {
    const video = await svc.publicar(admin, {
      ...fichaMinima,
      series: 'Palabras que permanecen',
      mediaAssetId: 'asset-video',
    })

    expect(video.title).toBe('Bienaventurados')
    expect(video.series).toBe('Palabras que permanecen')
    expect(video.status).toBe('PUBLISHED')
  })

  it('rechaza un medio que no es video', async () => {
    await expect(
      svc.publicar(admin, { ...fichaMinima, mediaAssetId: 'asset-imagen' }),
    ).rejects.toThrow(BadRequestException)
  })

  it('rechaza un medio de otra persona', async () => {
    await expect(
      svc.publicar(admin, { ...fichaMinima, mediaAssetId: 'asset-ajeno' }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('el admin ve también los ocultos', async () => {
    videos.seed(nuevoVideo({ id: 'v1', status: 'HIDDEN' }))

    const lista = await svc.listarParaAdmin(admin)

    expect(lista).toHaveLength(1)
    expect(lista[0]!.status).toBe('HIDDEN')
  })

  it('ocultar retira del catálogo sin borrar el archivo', async () => {
    videos.seed(nuevoVideo({ id: 'v1' }))

    await svc.cambiarEstado(admin, 'v1', 'HIDDEN')

    expect(await svc.catalogo()).toEqual([])
    expect(media.eliminados).toEqual([])
  })

  it('no se cambia al estado que ya tiene', async () => {
    videos.seed(nuevoVideo({ id: 'v1' }))
    await expect(svc.cambiarEstado(admin, 'v1', 'PUBLISHED')).rejects.toThrow(BadRequestException)
  })

  it('editar corrige la ficha sin tocar el archivo', async () => {
    videos.seed(nuevoVideo({ id: 'v1', mediaAssetId: 'asset-video' }))

    const editado = await svc.editar(admin, 'v1', { title: 'Otro título', reference: 'Mateo 5' })

    expect(editado.title).toBe('Otro título')
    expect(editado.reference).toBe('Mateo 5')
    expect(editado.mediaAssetId).toBe('asset-video')
  })

  it('eliminar borra el video y después su archivo', async () => {
    videos.seed(nuevoVideo({ id: 'v1', mediaAssetId: 'asset-video' }))

    await svc.eliminar(admin, 'v1')

    expect(videos.borrados).toEqual(['v1'])
    expect(media.eliminados).toEqual(['asset-video'])
  })

  it('un video inexistente no se administra', async () => {
    await expect(svc.cambiarEstado(admin, 'fantasma', 'HIDDEN')).rejects.toThrow(NotFoundException)
    await expect(svc.eliminar(admin, 'fantasma')).rejects.toThrow(NotFoundException)
  })

  it('solo el admin publica y administra', async () => {
    videos.seed(nuevoVideo({ id: 'v1' }))

    await expect(
      svc.publicar(maestro, { ...fichaMinima, mediaAssetId: 'asset-video' }),
    ).rejects.toThrow(ForbiddenException)
    await expect(svc.listarParaAdmin(maestro)).rejects.toThrow(ForbiddenException)
    await expect(svc.cambiarEstado(maestro, 'v1', 'HIDDEN')).rejects.toThrow(ForbiddenException)
    await expect(svc.eliminar(maestro, 'v1')).rejects.toThrow(ForbiddenException)
    expect(videos.borrados).toEqual([])
  })
})
