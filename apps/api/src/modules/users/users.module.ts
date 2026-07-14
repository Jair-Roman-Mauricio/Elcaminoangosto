import { Module } from '@nestjs/common'
import { UsersService } from './application/users.service'
import { UsersController } from './interface/users.controller'
import { ProfileRepository } from './domain/profile.repository'
import { AuthAdminPort } from './domain/auth-admin.port'
import { DrizzleProfileRepository } from './infrastructure/drizzle-profile.repository'
import { SupabaseAuthAdminAdapter } from './infrastructure/supabase-auth-admin.adapter'

/**
 * Bounded context `users`: perfiles, roles, niveles, mentoría.
 *
 * Exporta SOLO `UsersService`. Ningún otro módulo puede tocar
 * `ProfileRepository` ni las tablas de este contexto (AGENTS.md §4).
 */
@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    // El puerto se resuelve al adaptador Drizzle. Cambiar de ORM o de
    // proveedor solo toca esta línea.
    { provide: ProfileRepository, useClass: DrizzleProfileRepository },
    { provide: AuthAdminPort, useClass: SupabaseAuthAdminAdapter },
  ],
  exports: [UsersService],
})
export class UsersModule {}
