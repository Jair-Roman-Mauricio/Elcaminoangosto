import { SetMetadata } from '@nestjs/common'
import type { Role } from '@elcamino/shared-types'

export const ROLES_KEY = 'roles'

/** El ROL define capacidades. La propiedad y el nivel los valida `PolicyGuard`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

export const IS_PUBLIC_KEY = 'isPublic'

/** Marca una ruta como accesible sin JWT (landing, health, catálogo público). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
