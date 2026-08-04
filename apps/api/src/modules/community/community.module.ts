import { Module } from '@nestjs/common'
import { CommunityService } from './application/community.service'
import { CommunityController } from './interface/community.controller'
import { CommunityRepository } from './domain/community.repository'
import { DrizzleCommunityRepository } from './infrastructure/drizzle-community.repository'

/**
 * Bounded context `community`: hilos abiertos, sin cuentas.
 *
 * Exporta solo `CommunityService`. Ningún otro módulo toca sus tablas.
 */
@Module({
  controllers: [CommunityController],
  providers: [
    CommunityService,
    { provide: CommunityRepository, useClass: DrizzleCommunityRepository },
  ],
  exports: [CommunityService],
})
export class CommunityModule {}
