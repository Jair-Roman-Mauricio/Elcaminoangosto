import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { createHash, randomBytes } from 'node:crypto'

export interface TokenClaims extends JWTPayload {
  sub: string
  email?: string
}

const ISSUER = 'elcaminoangosto'
const AUDIENCE = 'authenticated'

/** SHA-256 en hex: lo que se guarda de un token opaco. El token en claro nunca toca la BD. */
export const huellaDe = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

/** Token opaco de un solo uso o de refresco: 256 bits, URL-safe. */
export const tokenOpaco = (): string => randomBytes(32).toString('base64url')

/** Firma y verifica los JWT de acceso (HS256, con el secreto del API). */
@Injectable()
export class TokenService {
  private readonly clave: Uint8Array
  private readonly ttl: number

  constructor(config: ConfigService) {
    this.clave = new TextEncoder().encode(config.getOrThrow<string>('JWT_SECRET'))
    this.ttl = config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS')
  }

  get accessTtlSeconds(): number {
    return this.ttl
  }

  async firmarAcceso(userId: string, email: string): Promise<string> {
    return new SignJWT({ email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.ttl}s`)
      .sign(this.clave)
  }

  async verificar(token: string): Promise<TokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.clave, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      })
      if (!payload.sub) throw new Error('El token no trae `sub`')
      return payload as TokenClaims
    } catch {
      throw new UnauthorizedException('Token inválido o expirado')
    }
  }
}
