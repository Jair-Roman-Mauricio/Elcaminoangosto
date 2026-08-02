import { Module } from '@nestjs/common'
import { AnalyticsController } from './interface/analytics.controller'
import { AnalyticsService } from './application/analytics.service'
import { AnalyticsRepository } from './domain/analytics.repository'
import { DrizzleAnalyticsRepository } from './infrastructure/drizzle-analytics.repository'

/**
 * Bounded context `analytics`: qué contenido se ve y quién entra.
 *
 * Mide con un identificador ALEATORIO de sesión de navegador; nunca IP ni
 * huella (RNF-9). Solo el admin consulta los informes.
 */
@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    { provide: AnalyticsRepository, useClass: DrizzleAnalyticsRepository },
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
