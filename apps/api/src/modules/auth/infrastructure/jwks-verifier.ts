import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

export interface TokenClaims extends JWTPayload {
  sub: string
  email?: string
}

/**
 * Verifica el JWT de Supabase contra las **claves asimétricas (JWKS)** del
 * proyecto (arquitectura.md §5).
 *
 * Deliberadamente NO se soporta el secreto compartido HS256 legacy: Supabase
 * lo desaconseja y una clave simétrica no permite rotación sin downtime.
 *
 * `createRemoteJWKSet` cachea el juego de claves y lo refresca solo cuando
 * aparece un `kid` desconocido, con cooldown para no ser un vector de DoS.
 */
@Injectable()
export class JwksVerifier {
  private readonly logger = new Logger(JwksVerifier.name)
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>
  private readonly issuer: string

  constructor(config: ConfigService) {
    const jwksUrl = config.getOrThrow<string>('SUPABASE_JWKS_URL')
    this.issuer = config.getOrThrow<string>('SUPABASE_JWT_ISSUER')

    this.jwks = createRemoteJWKSet(new URL(jwksUrl), {
      cacheMaxAge: 10 * 60 * 1000, // 10 min
      cooldownDuration: 30 * 1000,
    })
  }

  async verify(token: string): Promise<TokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: 'authenticated',
        // Solo firmas asimétricas. Un token HS256 será rechazado aquí.
        algorithms: ['RS256', 'ES256'],
      })

      if (!payload.sub) throw new Error('El token no trae `sub`')
      return payload as TokenClaims
    } catch (error) {
      this.logger.debug(`JWT rechazado: ${error instanceof Error ? error.message : String(error)}`)
      throw new UnauthorizedException('Token inválido o expirado')
    }
  }
}
