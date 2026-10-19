import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { compare, hash, hashSync } from 'bcryptjs'
import type { Pool } from 'pg'
import { PG_POOL } from '../../shared/database/database.module'
import { Mailer } from '../infrastructure/mailer'
import { TokenService, huellaDe, tokenOpaco } from '../infrastructure/token-service'

export interface SesionEmitida {
  accessToken: string
  refreshToken: string
  /** Segundos de vida del `accessToken`. */
  expiresIn: number
  user: { id: string; email: string; emailVerified: boolean }
}

interface FilaUsuario {
  id: string
  email: string
  password_hash: string
  email_verified_at: Date | null
}

const COSTE_BCRYPT = 12
const VIDA_TOKEN_CORREO_MS = 60 * 60 * 1000
/** Hash de relleno: login con correo inexistente cuesta lo mismo que uno real. */
const HASH_FALSO = hashSync('relleno-sin-uso', COSTE_BCRYPT)

/**
 * Cuentas y sesiones propias, sobre las tablas `users`, `refresh_tokens` y
 * `auth_tokens` de nuestro Postgres.
 *
 * Los hashes importados de Supabase son bcrypt y se verifican tal cual; al
 * entrar se vuelven a guardar con el coste actual.
 */
@Injectable()
export class AuthService {
  private readonly refreshTtlMs: number
  private readonly appUrl: string

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly tokens: TokenService,
    private readonly mailer: Mailer,
    config: ConfigService,
  ) {
    this.refreshTtlMs = config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 86_400_000
    this.appUrl = config.getOrThrow<string>('APP_URL').replace(/\/$/, '')
  }

  async registrar(email: string, password: string, displayName: string): Promise<void> {
    const correo = email.trim().toLowerCase()
    const passwordHash = await hash(password, COSTE_BCRYPT)
    const cliente = await this.pool.connect()
    let userId: string
    try {
      await cliente.query('begin')
      const existe = await cliente.query('select 1 from users where lower(email) = $1', [correo])
      if (existe.rowCount) {
        await cliente.query('rollback')
        // Mismo mensaje que un alta correcta: no se revela qué correos existen.
        return
      }
      const { rows } = await cliente.query<{ id: string }>(
        'insert into users (email, password_hash) values ($1, $2) returning id',
        [correo, passwordHash],
      )
      userId = rows[0]!.id
      await cliente.query(
        `insert into profiles (id, display_name, role) values ($1, $2, 'ESTUDIANTE')`,
        [userId, displayName.trim() || correo.split('@')[0]],
      )
      await cliente.query('commit')
    } catch (error) {
      await cliente.query('rollback').catch(() => undefined)
      throw error
    } finally {
      cliente.release()
    }
    await this.enviarVerificacion(userId, correo)
  }

  async entrar(email: string, password: string): Promise<SesionEmitida> {
    const usuario = await this.buscarPorCorreo(email)
    const valido = await compare(password, usuario?.password_hash ?? HASH_FALSO)
    if (!usuario || !valido) throw new UnauthorizedException('Correo o contraseña incorrectos')
    if (!usuario.email_verified_at) {
      throw new ForbiddenException('Confirma tu correo antes de entrar')
    }
    // Hash importado de Supabase (coste 10): se renueva con el coste actual.
    if (!usuario.password_hash.startsWith(`$2b$${COSTE_BCRYPT}$`)) {
      const nuevo = await hash(password, COSTE_BCRYPT)
      await this.pool.query('update users set password_hash = $2, updated_at = now() where id = $1', [
        usuario.id,
        nuevo,
      ])
    }
    return this.emitirSesion(usuario)
  }

  /** Rota el token de refresco: el usado queda revocado y se entrega uno nuevo. */
  async refrescar(refreshToken: string): Promise<SesionEmitida> {
    const huella = huellaDe(refreshToken)
    const { rows } = await this.pool.query<FilaUsuario & { token_id: string }>(
      `select t.id as token_id, u.id, u.email, u.password_hash, u.email_verified_at
         from refresh_tokens t join users u on u.id = t.user_id
        where t.token_hash = $1 and t.revoked_at is null and t.expires_at > now()`,
      [huella],
    )
    const fila = rows[0]
    if (!fila) throw new UnauthorizedException('Sesión expirada')
    await this.pool.query('update refresh_tokens set revoked_at = now() where id = $1', [fila.token_id])
    return this.emitirSesion(fila)
  }

  async salir(refreshToken: string): Promise<void> {
    await this.pool.query('update refresh_tokens set revoked_at = now() where token_hash = $1', [
      huellaDe(refreshToken),
    ])
  }

  async verificarCorreo(token: string): Promise<void> {
    const userId = await this.consumirToken(token, 'verify_email')
    await this.pool.query(
      'update users set email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = $1',
      [userId],
    )
  }

  async reenviarVerificacion(email: string): Promise<void> {
    const usuario = await this.buscarPorCorreo(email)
    if (usuario && !usuario.email_verified_at) await this.enviarVerificacion(usuario.id, usuario.email)
  }

  async pedirRecuperacion(email: string): Promise<void> {
    const usuario = await this.buscarPorCorreo(email)
    if (!usuario) return // misma respuesta exista o no
    const token = await this.crearToken(usuario.id, 'reset_password')
    const enlace = `${this.appUrl}/restablecer-contrasena?token=${token}`
    await this.mailer.enviar(
      usuario.email,
      'Restablece tu contraseña — El Camino Angosto',
      `<p>Para elegir una contraseña nueva entra aquí (vale una hora):</p><p><a href="${enlace}">${enlace}</a></p><p>Si no lo pediste, ignora este correo.</p>`,
      `Para elegir una contraseña nueva entra aquí (vale una hora): ${enlace}\nSi no lo pediste, ignora este correo.`,
    )
  }

  async restablecer(token: string, password: string): Promise<void> {
    const userId = await this.consumirToken(token, 'reset_password')
    const passwordHash = await hash(password, COSTE_BCRYPT)
    await this.pool.query(
      // Restablecer prueba que el titular lee ese correo: también lo verifica.
      `update users set password_hash = $2, email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = $1`,
      [userId, passwordHash],
    )
    await this.pool.query('update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null', [userId])
  }

  // ── internos ───────────────────────────────────────────────────────────

  private async buscarPorCorreo(email: string): Promise<FilaUsuario | null> {
    const { rows } = await this.pool.query<FilaUsuario>(
      'select id, email, password_hash, email_verified_at from users where lower(email) = $1',
      [email.trim().toLowerCase()],
    )
    return rows[0] ?? null
  }

  private async emitirSesion(usuario: FilaUsuario): Promise<SesionEmitida> {
    const refreshToken = tokenOpaco()
    await this.pool.query(
      'insert into refresh_tokens (user_id, token_hash, expires_at) values ($1, $2, $3)',
      [usuario.id, huellaDe(refreshToken), new Date(Date.now() + this.refreshTtlMs)],
    )
    return {
      accessToken: await this.tokens.firmarAcceso(usuario.id, usuario.email),
      refreshToken,
      expiresIn: this.tokens.accessTtlSeconds,
      user: { id: usuario.id, email: usuario.email, emailVerified: Boolean(usuario.email_verified_at) },
    }
  }

  private async crearToken(userId: string, proposito: 'verify_email' | 'reset_password'): Promise<string> {
    const token = tokenOpaco()
    await this.pool.query(
      'insert into auth_tokens (user_id, purpose, token_hash, expires_at) values ($1, $2, $3, $4)',
      [userId, proposito, huellaDe(token), new Date(Date.now() + VIDA_TOKEN_CORREO_MS)],
    )
    return token
  }

  /** Marca el token como usado y devuelve su usuario. Falla si no sirve. */
  private async consumirToken(token: string, proposito: string): Promise<string> {
    const { rows } = await this.pool.query<{ user_id: string }>(
      `update auth_tokens set used_at = now()
        where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now()
        returning user_id`,
      [huellaDe(token), proposito],
    )
    const fila = rows[0]
    if (!fila) throw new BadRequestException('El enlace no es válido o ya caducó')
    return fila.user_id
  }

  private async enviarVerificacion(userId: string, correo: string): Promise<void> {
    const token = await this.crearToken(userId, 'verify_email')
    const enlace = `${this.appUrl}/verificar-correo?token=${token}`
    await this.mailer.enviar(
      correo,
      'Confirma tu correo — El Camino Angosto',
      `<p>Confirma tu correo para entrar (vale una hora):</p><p><a href="${enlace}">${enlace}</a></p>`,
      `Confirma tu correo para entrar (vale una hora): ${enlace}`,
    )
  }
}

