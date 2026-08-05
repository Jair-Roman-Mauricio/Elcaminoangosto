import { describe, expect, it, vi } from 'vitest'
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../shared/decorators/roles.decorator'
import { VideosController } from './videos.controller'

describe('GET /videos', () => {
  it('es público y delega exclusivamente al catálogo publicado', async () => {
    const videos = { catalogo: vi.fn().mockResolvedValue([]) }
    const controller = new VideosController(videos as never)

    await expect(controller.catalogo()).resolves.toEqual([])
    expect(videos.catalogo).toHaveBeenCalledOnce()
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, VideosController.prototype.catalogo)).toBe(true)
  })

  it('comentar es público: no hay cuentas que exigir', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, VideosController.prototype.comentar)).toBe(true)
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, VideosController.prototype.comentarios)).toBe(true)
  })

  it('moderar un comentario sigue siendo solo del admin', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, VideosController.prototype.ocultarComentario),
    ).not.toBe(true)
    expect(Reflect.getMetadata(ROLES_KEY, VideosController.prototype.ocultarComentario)).toEqual([
      'ADMIN',
    ])
  })

  it('el comentario llega al servicio con su video y su autor', async () => {
    const videos = { comentar: vi.fn().mockResolvedValue({ id: 'c1' }) }
    const controller = new VideosController(videos as never)

    await controller.comentar('v1', { cuerpo: 'Gracias por esto', autorId: 'a'.repeat(20) })

    expect(videos.comentar).toHaveBeenCalledWith({
      videoId: 'v1',
      cuerpo: 'Gracias por esto',
      autorId: 'a'.repeat(20),
    })
  })
})
