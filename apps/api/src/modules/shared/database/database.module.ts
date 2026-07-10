import { Global, Module, Inject, type OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export const DRIZZLE = Symbol('DRIZZLE')
export const PG_CLIENT = Symbol('PG_CLIENT')

export type Database = PostgresJsDatabase<typeof schema>

/**
 * Único punto donde se abre la conexión a Postgres. Los repositorios de cada
 * módulo inyectan `DRIZZLE` y solo tocan las tablas de su propio contexto.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('DATABASE_URL')
        // `prepare: false` es obligatorio con el pooler de Supabase (pgbouncer
        // en modo transacción no soporta prepared statements con nombre).
        return postgres(url, { prepare: false, max: 10 })
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_CLIENT],
      useFactory: (client: postgres.Sql) => drizzle(client, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_CLIENT) private readonly client: postgres.Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 })
  }
}
