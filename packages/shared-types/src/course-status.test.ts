import { describe, it, expect } from 'vitest'
import {
  canTransition,
  isEditableByTeacher,
  isVisibleToStudents,
  COURSE_TRANSITIONS,
  CourseStatusSchema,
  type CourseStatus,
} from './course-status'

const ALL = CourseStatusSchema.options

describe('máquina de estados de publicación de curso', () => {
  it('un curso de maestro NUNCA se autopublica (contexto.md §5)', () => {
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(false)
    expect(canTransition('SUBMITTED', 'PUBLISHED')).toBe(false)
    expect(canTransition('UNDER_REVIEW', 'PUBLISHED')).toBe(false)
    // El único camino a PUBLISHED pasa por APPROVED.
    const haciaPublished = ALL.filter((s) => canTransition(s, 'PUBLISHED'))
    expect(haciaPublished).toEqual(['APPROVED'])
  })

  it('recorre el camino feliz completo', () => {
    const camino: CourseStatus[] = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED']
    for (let i = 0; i < camino.length - 1; i++) {
      expect(canTransition(camino[i]!, camino[i + 1]!)).toBe(true)
    }
  })

  it('un rechazo devuelve el curso a manos del maestro', () => {
    expect(canTransition('UNDER_REVIEW', 'REJECTED')).toBe(true)
    expect(canTransition('REJECTED', 'DRAFT')).toBe(true)
  })

  it('ARCHIVED es terminal', () => {
    expect(COURSE_TRANSITIONS.ARCHIVED).toHaveLength(0)
    for (const destino of ALL) {
      expect(canTransition('ARCHIVED', destino)).toBe(false)
    }
  })

  it('se archiva desde APPROVED y desde PUBLISHED, nunca desde DRAFT', () => {
    expect(canTransition('PUBLISHED', 'ARCHIVED')).toBe(true)
    expect(canTransition('APPROVED', 'ARCHIVED')).toBe(true)
    expect(canTransition('DRAFT', 'ARCHIVED')).toBe(false)
  })

  it('ningún estado transiciona a sí mismo', () => {
    for (const s of ALL) {
      expect(canTransition(s, s)).toBe(false)
    }
  })

  it('el maestro solo edita la estructura crítica en DRAFT (HU-5.1)', () => {
    expect(isEditableByTeacher('DRAFT')).toBe(true)
    for (const s of ALL.filter((x) => x !== 'DRAFT')) {
      expect(isEditableByTeacher(s)).toBe(false)
    }
  })

  it('solo PUBLISHED es visible en el catálogo del estudiante', () => {
    expect(ALL.filter(isVisibleToStudents)).toEqual(['PUBLISHED'])
  })
})
