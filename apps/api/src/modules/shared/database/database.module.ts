import { Global, Logger, Module, Inject, type OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export const DRIZZLE = Symbol('DRIZZLE')
export const PG_CLIENT = Symbol('PG_CLIENT')

export type Database = PostgresJsDatabase<typeof schema>

/**
 * Techo de duración de UNA consulta. Lo aplica el servidor: pasado el plazo
 * mata la consulta y devuelve el error, así la conexión vuelve al pool.
 */
const STATEMENT_TIMEOUT_MS = 15_000

/**
 * Opciones comunes del pool.
 *
 * Sin caducidades, una conexión que deja de responder —el pooler la cerró por
 * su lado, un cortafuegos la comió— se queda en el pool para siempre y sigue
 * recibiendo consultas que nadie contestará. Con `max: 10`, diez conexiones
 * así dejan el API entero esperando: es lo que ocurrió el 16/08/2026, cuando
 * el catálogo, los videos y los devocionales dejaron de cargar en producción
 * mientras el proceso seguía vivo y `/health` seguía en verde.
 */
const OPCIONES_BASE = {
  // Obligatorio con el pooler de Supabase (pgbouncer en modo transacción no
  // soporta prepared statements con nombre).
  prepare: false,
  max: 10,
  /** Una conexión ociosa se cierra: si estaba muerta, no vuelve a usarse. */
  idle_timeout: 30,
  /** Y ninguna vive más de media hora, ocupada o no. */
  max_lifetime: 60 * 30,
  /** Si la BD no acepta la conexión, fallar y decirlo. Colgarse es peor. */
  connect_timeout: 10,
} satisfies postgres.Options<Record<string, never>>

/**
 * Abre el pool con `statement_timeout` y, si el pooler rechaza ese parámetro
 * de arranque, reabre sin él.
 *
 * Supavisor no acepta cualquier parámetro en el saludo inicial, y eso varía
 * entre versiones. Sin esta comprobación, un parámetro no admitido no degrada
 * el servicio: lo apaga entero, porque ninguna conexión llegaría a abrirse.
 */
async function abrirPool(url: string, logger: Logger): Promise<postgres.Sql> {
  const conLimite = postgres(url, {
    ...OPCIONES_BASE,
    connection: { statement_timeout: STATEMENT_TIMEOUT_MS },
  })
  try {
    await conLimite`select 1`
    return conLimite
  } catch (error) {
    await conLimite.end({ timeout: 5 }).catch(() => undefined)
    logger.warn(
      `El pooler no admitió statement_timeout (${(error as Error).message}). ` +
        'Se abre el pool sin límite por consulta; considera fijarlo en el rol de la BD.',
    )
    return postgres(url, OPCIONES_BASE)
  }
}

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
      useFactory: (config: ConfigService) =>
        abrirPool(config.getOrThrow<string>('DATABASE_URL'), new Logger('DatabaseModule')),
    },
    {
      provide: DRIZZLE,
      inject: [PG_CLIENT],
      useFactory: (client: postgres.Sql) => drizzle(client, { schema }),
    },
  ],
  exports: [DRIZZLE, PG_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_CLIENT) private readonly client: postgres.Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 })
  }
}
