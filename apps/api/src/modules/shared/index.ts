/**
 * API pública del núcleo común. `shared` no es un bounded context: no tiene
 * reglas de negocio propias y cualquier módulo puede depender de él.
 */
export {
  puedeEditarRecurso,
  cumpleNivel,
  puedeAccederRecurso,
  motivoDeBloqueo,
  type Actor,
  type OwnedResource,
  type LeveledResource,
} from './domain/policies'

export { SharedModule } from './shared.module'
export { PolicyRegistry, type PolicyLoader, type PolicyResource } from './guards/policy.registry'
export { PolicyGuard, Policy, type PolicySpec } from './guards/policy.guard'
export { RolesGuard } from './guards/roles.guard'
export { Roles, Public } from './decorators/roles.decorator'
export { CurrentUser, type CurrentUserContext } from './decorators/current-user.decorator'
export { ZodValidationPipe } from './pipes/zod-validation.pipe'
export { HttpExceptionFilter } from './filters/http-exception.filter'
export { DRIZZLE, DatabaseModule, type Database } from './database/database.module'
