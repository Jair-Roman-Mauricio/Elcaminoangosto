import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { sql } from 'drizzle-orm'
import { Public } from '../decorators/roles.decorator'
import { DRIZZLE, type Database } from '../database/database.module'

/** Más que esto esperando por un `select 1` significa que la BD no está. */
const LIMITE_MS = 3_000

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Comprueba la BD, no solo que el proceso siga en pie (RNF-5).
   *
   * Antes respondía `ok` sin tocar nada: el 16/08 el API se quedó sin
   * conexiones libres, ninguna página cargó durante días y este endpoint —y
   * con él la prueba de humo del despliegue— siguió en verde. Una salud que
   * no puede ponerse roja no avisa de nada.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check: proceso y base de datos (RNF-5)' })
  async check() {
    const timestamp = new Date().toISOString()
    try {
      await Promise.race([
        this.db.execute(sql`select 1`),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('sin respuesta')), LIMITE_MS).unref(),
        ),
      ])
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        database: 'unreachable',
        timestamp,
      })
    }
    return { status: 'ok', database: 'ok', timestamp }
  }
}
