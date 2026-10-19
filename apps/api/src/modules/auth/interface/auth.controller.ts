import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { z } from 'zod'
import { AuthService } from '../application/auth.service'
import { Public, ZodValidationPipe } from '../../shared'

const Correo = z.string().email().max(254)
const Clave = z.string().min(8).max(128)
const Token = z.string().min(20).max(200)

const EntrarSchema = z.object({ email: Correo, password: z.string().min(1).max(128) })
const RefrescoSchema = z.object({ refreshToken: Token })
const SoloCorreoSchema = z.object({ email: Correo })
const SoloTokenSchema = z.object({ token: Token })
const RestablecerSchema = z.object({ token: Token, password: Clave })

/** Los endpoints de cuentas son blanco de fuerza bruta: tope bajo por IP. */
const TOPE = { default: { limit: 10, ttl: 60_000 } }

@ApiTags('auth')
@Public()
@Throttle(TOPE)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async entrar(@Body(new ZodValidationPipe(EntrarSchema)) b: z.infer<typeof EntrarSchema>) {
    return this.auth.entrar(b.email, b.password)
  }

  @Post('refresh')
  @HttpCode(200)
  async refrescar(@Body(new ZodValidationPipe(RefrescoSchema)) b: z.infer<typeof RefrescoSchema>) {
    return this.auth.refrescar(b.refreshToken)
  }

  @Post('logout')
  @HttpCode(200)
  async salir(@Body(new ZodValidationPipe(RefrescoSchema)) b: z.infer<typeof RefrescoSchema>) {
    await this.auth.salir(b.refreshToken)
    return { ok: true }
  }

  @Post('verify-email')
  @HttpCode(200)
  async verificar(@Body(new ZodValidationPipe(SoloTokenSchema)) b: z.infer<typeof SoloTokenSchema>) {
    await this.auth.verificarCorreo(b.token)
    return { ok: true }
  }

  @Post('resend-verification')
  @HttpCode(202)
  async reenviar(@Body(new ZodValidationPipe(SoloCorreoSchema)) b: z.infer<typeof SoloCorreoSchema>) {
    await this.auth.reenviarVerificacion(b.email)
    return { ok: true }
  }

  @Post('forgot-password')
  @HttpCode(202)
  async olvide(@Body(new ZodValidationPipe(SoloCorreoSchema)) b: z.infer<typeof SoloCorreoSchema>) {
    await this.auth.pedirRecuperacion(b.email)
    return { ok: true }
  }

  @Post('reset-password')
  @HttpCode(200)
  async restablecer(
    @Body(new ZodValidationPipe(RestablecerSchema)) b: z.infer<typeof RestablecerSchema>,
  ) {
    await this.auth.restablecer(b.token, b.password)
    return { ok: true }
  }
}
