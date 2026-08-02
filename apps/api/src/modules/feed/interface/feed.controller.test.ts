import { describe, expect, it, vi } from 'vitest'
import { IS_PUBLIC_KEY } from '../../shared/decorators/roles.decorator'
import { FeedController } from './feed.controller'

describe('GET /feed', () => {
  it('está marcado como público y no necesita un actor', async () => {
    const feed = { feed: vi.fn().mockResolvedValue([]) }
    const controller = new FeedController(feed as never)

    await expect(controller.listar()).resolves.toEqual([])
    expect(feed.feed).toHaveBeenCalledWith(20, null)
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, FeedController.prototype.listar)).toBe(true)
  })
})
