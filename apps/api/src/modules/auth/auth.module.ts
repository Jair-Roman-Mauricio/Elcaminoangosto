import { Module } from '@nestjs/common'
import { JwksVerifier } from './infrastructure/jwks-verifier'
import { SupabaseAuthGuard } from './interface/supabase-auth.guard'
import { UsersModule } from '../users'

/**
 * Bounded context `auth`: verificación del JWT de Supabase (JWKS asimétrico)
 * y construcción del contexto de usuario. No persiste nada.
 */
@Module({
  imports: [UsersModule],
  providers: [JwksVerifier, SupabaseAuthGuard],
  exports: [SupabaseAuthGuard, JwksVerifier],
})
export class AuthModule {}
