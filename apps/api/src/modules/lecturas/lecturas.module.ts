import { Module } from '@nestjs/common'
import { LecturasController } from './interface/lecturas.controller'
import { LecturasService } from './application/lecturas.service'
import { LecturasRepository } from './domain/lecturas.repository'
import { DrizzleLecturasRepository } from './infrastructure/drizzle-lecturas.repository'
import { MediaModule } from '../media'

/**
 * Bounded context `lecturas`: devocionales y oraciones guiadas.
 *
 * Comparten módulo porque comparten forma —texto que publica la
 * administración y lee cualquiera— y separarlos habría duplicado la estructura
 * entera sin compartir nada más que la duplicación.
 */
@Module({
  imports: [MediaModule],
  controllers: [LecturasController],
  providers: [LecturasService, { provide: LecturasRepository, useClass: DrizzleLecturasRepository }],
  exports: [LecturasService],
})
export class LecturasModule {}
