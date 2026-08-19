/**
 * API pública del núcleo común. `shared` no es un bounded context: no tiene
 * reglas de negocio propias y cualquier módulo puede depender de él.
 */
export {
  puedeEditarRecurso,
  type Actor,
  type OwnedResource,
} from './domain/policies'

export { SharedModule } from './shared.module'
export { RolesGuard } from './guards/roles.guard'
export { Roles, Public } from './decorators/roles.decorator'
export { CurrentUser, type CurrentUserContext } from './decorators/current-user.decorator'
export { UsuarioOpcional } from './decorators/usuario-opcional.decorator'
export { ZodValidationPipe } from './pipes/zod-validation.pipe'
export { HttpExceptionFilter } from './filters/http-exception.filter'
export { TimeoutInterceptor } from './interface/timeout.interceptor'
export { DRIZZLE, DatabaseModule, type Database } from './database/database.module'
