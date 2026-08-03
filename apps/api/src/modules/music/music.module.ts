import { Module } from '@nestjs/common'
import { MusicController } from './interface/music.controller'
import { MusicService } from './application/music.service'
import { ColeccionRepository, MusicRepository } from './domain/music.repository'
import { DrizzleMusicRepository } from './infrastructure/drizzle-music.repository'
import { DrizzleColeccionRepository } from './infrastructure/drizzle-coleccion.repository'
import { MediaModule } from '../media'

/**
 * Bounded context `music` (HU-9.2): catálogo de Alabanza —artistas, álbumes y
 * canciones— que el ADMIN publica desde el módulo Contenido.
 *
 * Capas: interface / application / domain / infrastructure. Usa el servicio
 * público de `media` para firmar el audio; no conoce Storage.
 */
@Module({
  imports: [MediaModule],
  controllers: [MusicController],
  providers: [
    MusicService,
    { provide: MusicRepository, useClass: DrizzleMusicRepository },
    { provide: ColeccionRepository, useClass: DrizzleColeccionRepository },
  ],
  exports: [MusicService],
})
export class MusicModule {}
