import { Global, Logger, Module, Inject, type OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export const DRIZZLE = Symbol('DRIZZLE')
export const PG_POOL = Symbol('PG_POOL')

export type Database = NodePgDatabase<typeof schema>

/**
 * Techo de duración de UNA consulta, por los dos lados.
 *
 * `statement_timeout` lo aplica Postgres: mata la consulta y contesta. Pero
 * eso solo sirve si la respuesta llega. `query_timeout` lo aplica el cliente:
 * pasado el plazo da la consulta por perdida, DESTRUYE la conexión y la saca
 * del pool. Es el único de los dos que salva al API de una conexión que se
 * quedó muda, y es la razón de haber cambiado de driver.
 */
const TIMEOUT_MS = 15_000

/**
 * Único punto donde se abre la conexión a Postgres. Los repositorios de cada
 * módulo inyectan `DRIZZLE` y solo tocan las tablas de su propio contexto.
 *
 * Se usa `node-postgres` y no `postgres.js` por una razón concreta y cara: con
 * el pooler de Supabase (Supavisor, modo transacción) postgres.js se queda con
 * conexiones que envían la consulta y no reciben respuesta jamás —está
 * reportado en porsager/postgres#970— y no ofrece ningún plazo del lado del
 * cliente. Esas conexiones cuentan como ocupadas, así que ni `idle_timeout` ni
 * `max_lifetime` las tocan: se quedan en el pool para siempre. Con `max: 10`,
 * diez así dejan el API entero esperando. Producción se cayó dos veces por
 * esto (16 y 21 de agosto de 2026): el proceso vivo, sin un solo error en el
 * registro, y ni catálogo, ni videos, ni tarjetas, ni devocionales.
 *
 * `pg` sí corta del lado del cliente y tira la conexión enferma, que es lo
 * único que devuelve el pool a la vida sin reiniciar el servicio.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
          max: 10,
          /** El cliente se rinde y descarta la conexión. Ver arriba. */
          query_timeout: TIMEOUT_MS,
          /** Y el servidor mata su lado, para no dejar la consulta corriendo. */
          statement_timeout: TIMEOUT_MS,
          /** Esperar sitio en el pool tampoco puede ser eterno. */
          connectionTimeoutMillis: 10_000,
          /** Una conexión ociosa se cierra: si estaba muerta, no vuelve a usarse. */
          idleTimeoutMillis: 30_000,
          keepAlive: true,
        }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema }),
    },
  ],
  exports: [DRIZZLE, PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name)

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    // Sin este oyente, un error en una conexión OCIOSA es un `error` sin
    // escuchar en un EventEmitter: Node tumba el proceso entero.
    this.pool.on('error', (error) => {
      this.logger.warn(`Conexión descartada del pool: ${error.message}`)
    })
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }
}
