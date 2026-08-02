import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseAuthGuard } from './supabase-auth.guard'

function contexto(headers: Record<string, string | undefined> = {}) {
  return {
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as never
}

describe('SupabaseAuthGuard', () => {
  it('permite una lectura marcada pública sin consultar JWT ni perfil', async () => {
    const verifier = { verify: vi.fn() }
    const users = { buscarPerfil: vi.fn() }
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) }
    const guard = new SupabaseAuthGuard(reflector as never, verifier as never, users as never)

    await expect(guard.canActivate(contexto())).resolves.toBe(true)
    expect(verifier.verify).not.toHaveBeenCalled()
    expect(users.buscarPerfil).not.toHaveBeenCalled()
  })

  it('mantiene el requisito de JWT para rutas privadas como Discipulado y escrituras', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) }
    const guard = new SupabaseAuthGuard(reflector as never, {} as never, {} as never)

    await expect(guard.canActivate(contexto())).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
