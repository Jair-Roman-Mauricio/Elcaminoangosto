import { describe, expect, it, vi } from 'vitest'
import { IS_PUBLIC_KEY } from '../../shared/decorators/roles.decorator'
import { MusicController } from './music.controller'

describe('GET /music/catalog', () => {
  it('es público y delega exclusivamente al catálogo publicado', async () => {
    const music = { catalogo: vi.fn().mockResolvedValue({ albumes: [], canciones: [] }) }
    const controller = new MusicController(music as never)

    await expect(controller.catalogo()).resolves.toEqual({ albumes: [], canciones: [] })
    expect(music.catalogo).toHaveBeenCalledOnce()
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, MusicController.prototype.catalogo)).toBe(true)
  })
})
