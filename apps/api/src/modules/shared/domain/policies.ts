import type { Role } from '@elcamino/shared-types'

/**
 * Políticas de acceso fino, como funciones puras del dominio.
 * Sin framework, sin BD: testeables en aislamiento.
 *
 * Regla de oro (contexto.md §4): el ROL define capacidades;
 * la PROPIEDAD del recurso y el NIVEL definen el acceso fino.
 */

export interface Actor {
  id: string
  role: Role
  levelRank: number
}

/** Un recurso con dueño (curso de un maestro, playlist, post, perfil…). */
export interface OwnedResource {
  ownerId: string
}

/** Un recurso restringido por nivel de madurez del estudiante. */
export interface LeveledResource {
  /** `null` = sin restricción de nivel (curso abierto). */
  requiredLevelRank: number | null
}

/** El ADMIN no tiene restricciones de propiedad (contexto.md §4.3). */
export function puedeEditarRecurso(actor: Actor, recurso: OwnedResource): boolean {
  if (actor.role === 'ADMIN') return true
  return recurso.ownerId === actor.id
}

/**
 * Un estudiante entra a cursos de su nivel o inferiores (HU-4.1).
 * Maestros y admins no están limitados por nivel.
 */
export function cumpleNivel(actor: Actor, recurso: LeveledResource): boolean {
  if (actor.role === 'ADMIN' || actor.role === 'MAESTRO') return true
  if (recurso.requiredLevelRank === null) return true
  return actor.levelRank >= recurso.requiredLevelRank
}

/** Acceso de lectura a un recurso gated: exige nivel, o ser el dueño. */
export function puedeAccederRecurso(
  actor: Actor,
  recurso: OwnedResource & LeveledResource,
): boolean {
  if (puedeEditarRecurso(actor, recurso)) return true
  return cumpleNivel(actor, recurso)
}

/**
 * Motivo del bloqueo, para devolver un 403 con mensaje claro (HU-4.1).
 * `null` significa que sí tiene acceso.
 */
export function motivoDeBloqueo(
  actor: Actor,
  recurso: OwnedResource & LeveledResource,
): string | null {
  if (puedeAccederRecurso(actor, recurso)) return null
  if (!cumpleNivel(actor, recurso)) {
    return `Este contenido requiere el nivel ${recurso.requiredLevelRank}. Tu nivel actual es ${actor.levelRank}.`
  }
  return 'No tienes permiso sobre este recurso.'
}
