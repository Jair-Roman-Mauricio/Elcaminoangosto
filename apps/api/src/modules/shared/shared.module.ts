import { Global, Module } from '@nestjs/common'
import { RolesGuard } from './guards/roles.guard'
import { DatabaseModule } from './database/database.module'

/**
 * Piezas transversales. `@Global` para que cada bounded context pueda usar
 * guards y BD sin reimportar. No contiene lógica de negocio de ningún módulo.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [RolesGuard],
  exports: [RolesGuard, DatabaseModule],
})
export class SharedModule {}
