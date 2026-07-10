import { z } from 'zod'

/**
 * Regla de oro (contexto.md §4): el ROL define capacidades;
 * la PROPIEDAD del recurso y el NIVEL definen el acceso fino.
 */
export const RoleSchema = z.enum(['ESTUDIANTE', 'MAESTRO', 'ADMIN'])
export type Role = z.infer<typeof RoleSchema>

export const ROLES = RoleSchema.options

/** Un ADMIN nunca está sujeto a restricciones de propiedad. */
export function isAdmin(role: Role): boolean {
  return role === 'ADMIN'
}
