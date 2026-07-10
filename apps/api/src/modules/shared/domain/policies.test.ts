import { describe, it, expect } from 'vitest'
import {
  puedeEditarRecurso,
  cumpleNivel,
  puedeAccederRecurso,
  motivoDeBloqueo,
  type Actor,
} from './policies'

const admin: Actor = { id: 'a1', role: 'ADMIN', levelRank: 0 }
const maestro: Actor = { id: 'm1', role: 'MAESTRO', levelRank: 0 }
const otroMaestro: Actor = { id: 'm2', role: 'MAESTRO', levelRank: 0 }
const estudiante: Actor = { id: 'e1', role: 'ESTUDIANTE', levelRank: 2 }

describe('propiedad del recurso', () => {
  const cursoDeM1 = { ownerId: 'm1', requiredLevelRank: null }

  it('un maestro edita SUS cursos', () => {
    expect(puedeEditarRecurso(maestro, cursoDeM1)).toBe(true)
  })

  it('un maestro NO edita los cursos de otro maestro', () => {
    expect(puedeEditarRecurso(otroMaestro, cursoDeM1)).toBe(false)
  })

  it('el admin no tiene restricciones de propiedad', () => {
    expect(puedeEditarRecurso(admin, cursoDeM1)).toBe(true)
  })

  it('un estudiante no edita cursos ajenos', () => {
    expect(puedeEditarRecurso(estudiante, cursoDeM1)).toBe(false)
  })
})

describe('acceso por nivel', () => {
  it('el estudiante entra a cursos de su nivel o inferior', () => {
    expect(cumpleNivel(estudiante, { requiredLevelRank: 1 })).toBe(true)
    expect(cumpleNivel(estudiante, { requiredLevelRank: 2 })).toBe(true)
  })

  it('el estudiante NO entra a cursos de nivel superior', () => {
    expect(cumpleNivel(estudiante, { requiredLevelRank: 3 })).toBe(false)
  })

  it('un curso sin nivel requerido está abierto', () => {
    expect(cumpleNivel(estudiante, { requiredLevelRank: null })).toBe(true)
  })

  it('maestros y admins no están limitados por nivel', () => {
    expect(cumpleNivel(maestro, { requiredLevelRank: 9 })).toBe(true)
    expect(cumpleNivel(admin, { requiredLevelRank: 9 })).toBe(true)
  })
})

describe('acceso combinado y motivo del bloqueo', () => {
  const cursoNivel3 = { ownerId: 'm1', requiredLevelRank: 3 }

  it('el dueño accede aunque no cumpla el nivel', () => {
    expect(puedeAccederRecurso(maestro, cursoNivel3)).toBe(true)
  })

  it('el estudiante de nivel 2 queda bloqueado con un motivo legible', () => {
    expect(puedeAccederRecurso(estudiante, cursoNivel3)).toBe(false)
    expect(motivoDeBloqueo(estudiante, cursoNivel3)).toBe(
      'Este contenido requiere el nivel 3. Tu nivel actual es 2.',
    )
  })

  it('sin bloqueo, el motivo es null', () => {
    expect(motivoDeBloqueo(estudiante, { ownerId: 'm1', requiredLevelRank: 1 })).toBeNull()
  })
})
