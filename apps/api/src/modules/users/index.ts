/**
 * API pública del módulo `users`.
 * Es lo ÚNICO que otros bounded contexts pueden importar de aquí.
 */
export { UsersService } from './application/users.service'
export { UsersModule } from './users.module'
export type { ProfileEntity } from './domain/profile.repository'
