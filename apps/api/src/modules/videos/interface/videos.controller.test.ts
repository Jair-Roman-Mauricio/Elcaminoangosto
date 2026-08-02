import { describe, expect, it, vi } from 'vitest'
import { IS_PUBLIC_KEY } from '../../shared/decorators/roles.decorator'
import { VideosController } from './videos.controller'

describe('GET /videos', () => {
  it('es público y delega exclusivamente al catálogo publicado', async () => {
    const videos = { catalogo: vi.fn().mockResolvedValue([]) }
    const controller = new VideosController(videos as never)

    await expect(controller.catalogo()).resolves.toEqual([])
    expect(videos.catalogo).toHaveBeenCalledOnce()
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, VideosController.prototype.catalogo)).toBe(true)
  })

  it('no marca la escritura de comentarios como pública', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, VideosController.prototype.comentar)).not.toBe(true)
  })
})
