import { describe, expect, it } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'
import { SignJWT } from 'jose'
import type { ConfigService } from '@nestjs/config'
import { TokenService, huellaDe, tokenOpaco } from './token-service'

const SECRETO = 'un-secreto-de-prueba-de-al-menos-32-caracteres'
const config = (secreto = SECRETO, ttl = 900) =>
  ({ getOrThrow: (k: string) => (k === 'JWT_SECRET' ? secreto : ttl) }) as unknown as ConfigService

describe('TokenService', () => {
  it('firma un acceso que se verifica y trae sub y correo', async () => {
    const t = new TokenService(config())
    const claims = await t.verificar(await t.firmarAcceso('u-1', 'a@b.co'))
    expect(claims.sub).toBe('u-1')
    expect(claims.email).toBe('a@b.co')
  })

  it('rechaza un token firmado con otro secreto', async () => {
    const ajeno = new TokenService(config('otro-secreto-distinto-de-32-caracteres-ok'))
    const t = new TokenService(config())
    await expect(t.verificar(await ajeno.firmarAcceso('u-1', 'a@b.co'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('rechaza un token vencido', async () => {
    const t = new TokenService(config())
    const vencido = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u-1')
      .setIssuer('elcaminoangosto')
      .setAudience('authenticated')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRETO))
    await expect(t.verificar(vencido)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rechaza un token sin firma (alg none)', async () => {
    const t = new TokenService(config())
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const sinFirma = `${b64({ alg: 'none' })}.${b64({ sub: 'u-1', iss: 'elcaminoangosto', aud: 'authenticated' })}.`
    await expect(t.verificar(sinFirma)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('los tokens opacos son únicos y su huella es estable', () => {
    expect(tokenOpaco()).not.toBe(tokenOpaco())
    expect(huellaDe('x')).toBe(huellaDe('x'))
    expect(huellaDe('x')).not.toBe(huellaDe('y'))
  })
})
