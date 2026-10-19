import { Module } from '@nestjs/common'
import { TokenService } from './infrastructure/token-service'
import { Mailer } from './infrastructure/mailer'
import { AuthService } from './application/auth.service'
import { AuthController } from './interface/auth.controller'
import { JwtAuthGuard } from './interface/jwt-auth.guard'
import { UsersModule } from '../users'

/**
 * Bounded context `auth`: cuentas, contraseñas, sesiones (JWT de acceso +
 * token de refresco rotativo) y correos de verificación y recuperación.
 */
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [TokenService, Mailer, AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard, TokenService],
})
export class AuthModule {}
