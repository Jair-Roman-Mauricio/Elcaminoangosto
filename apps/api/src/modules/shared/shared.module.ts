import { Global, Module } from '@nestjs/common'
import { PolicyRegistry } from './guards/policy.registry'
import { RolesGuard } from './guards/roles.guard'
import { PolicyGuard } from './guards/policy.guard'
import { DatabaseModule } from './database/database.module'

/**
 * Piezas transversales. `@Global` para que cada bounded context pueda usar
 * guards y BD sin reimportar. No contiene lógica de negocio de ningún módulo.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [PolicyRegistry, RolesGuard, PolicyGuard],
  exports: [PolicyRegistry, RolesGuard, PolicyGuard, DatabaseModule],
})
export class SharedModule {}
