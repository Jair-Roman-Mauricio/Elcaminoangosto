import type { Role } from '@elcamino/shared-types'

/**
 * Políticas de acceso, como funciones puras del dominio.
 * Sin framework, sin BD: testeables en aislamiento.
 *
 * Con la plataforma abierta solo queda una regla: el contenido lo administra
 * el ADMIN, y la propiedad decide el acceso fino sobre lo que tiene dueño.
 */

export interface Actor {
  id: string
  role: Role
}

/** Un recurso con dueño. */
export interface OwnedResource {
  ownerId: string
}

/** El ADMIN no tiene restricciones de propiedad (contexto.md §4.3). */
export function puedeEditarRecurso(actor: Actor, recurso: OwnedResource): boolean {
  if (actor.role === 'ADMIN') return true
  return recurso.ownerId === actor.id
}
