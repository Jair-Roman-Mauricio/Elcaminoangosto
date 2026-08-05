import { Module } from '@nestjs/common'
import { ConsejeriaService } from './application/consejeria.service'
import { ConsejerosRepository } from './domain/consejeros.repository'
import { DrizzleConsejerosRepository } from './infrastructure/drizzle-consejeros.repository'
import { ConsejeriaController } from './interface/consejeria.controller'
import { MediaModule } from '../media'

@Module({
  imports: [MediaModule],
  controllers: [ConsejeriaController],
  providers: [
    ConsejeriaService,
    { provide: ConsejerosRepository, useClass: DrizzleConsejerosRepository },
  ],
  exports: [ConsejeriaService],
})
export class ConsejeriaModule {}
