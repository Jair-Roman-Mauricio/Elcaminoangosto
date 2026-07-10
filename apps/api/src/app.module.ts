import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'

import { validateEnv } from './modules/shared/config/env'
import { SharedModule } from './modules/shared/shared.module'
import { HealthController } from './modules/shared/interface/health.controller'
import { AuthModule, SupabaseAuthGuard } from './modules/auth'
import { UsersModule } from './modules/users'
import { MusicModule } from './modules/music'
import { FeedModule } from './modules/feed'
import { DiscipleshipModule } from './modules/discipleship'
import { ChatModule } from './modules/chat'
import { MediaModule } from './modules/media'
import { AdminModule } from './modules/admin'
import { NotificationsModule } from './modules/notifications'

/**
 * Monolito modular: un solo desplegable, fronteras internas explícitas.
 * Cada módulo es un bounded context (arquitectura.md §2).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Nunca registrar credenciales (AGENTS.md §7).
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        // En producción, JSON estructurado a stdout (RNF-7).
        ...(process.env.NODE_ENV !== 'production'
          ? { transport: { target: 'pino-pretty' } }
          : {}),
      },
    }),

    // Comunicación entre módulos. Al extraer un módulo a servicio propio,
    // este emisor se sustituye por un broker sin tocar los consumidores.
    EventEmitterModule.forRoot({ wildcard: false, verboseMemoryLeak: true }),

    // RNF-4: rate limiting.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    SharedModule,
    AuthModule,
    UsersModule,
    MusicModule,
    FeedModule,
    DiscipleshipModule,
    ChatModule,
    MediaModule,
    AdminModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Autenticación por defecto en TODA ruta. Se exceptúa con @Public().
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
