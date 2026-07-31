import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'

/* Contratos que devuelve el API de discipleship (espejo del servidor). */

export interface CatalogItem {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailAssetId: string | null
  requiredLevelRank: number | null
  isFree: boolean
  coverImageUrl: string | null
  teacherName: string
  moduleCount: number
  lessonCount: number
  unlocked: boolean
  enrolled: boolean
  progressPct?: number
  lockedReason: string | null
}

export interface Lesson {
  id: string
  moduleId: string
  title: string
  type: 'VIDEO' | 'TEXT' | 'EXAM' | 'IMAGE'
  content: string | null
  mediaAssetId: string | null
  /** URL firmada de reproducción (video ya procesado); null si aún no está listo. */
  videoUrl?: string | null
  /** Preguntas de la evaluación. `correcta` solo llega en el preview del maestro. */
  questions?: PreguntaLeccion[]
  orderIndex: number
  durationSeconds: number | null
  resources?: LessonResource[]
  /** Estado de moderación (HU-7.2): APPROVED | PENDING | BLOCKED. */
  moderationStatus?: 'APPROVED' | 'PENDING' | 'BLOCKED'
}

export interface PreguntaLeccion {
  enunciado: string
  opciones: string[]
  /** Índice correcto; presente solo para el maestro (nunca para el alumno). */
  correcta?: number
}

export interface LessonResource {
  id: string
  title: string
  url: string
  kind?: 'FILE' | 'LINK' | 'PDF'
}

export interface CourseModule {
  id: string
  title: string
  orderIndex: number
  lessons: Lesson[]
}

export interface CourseDetail {
  id: string
  title: string
  description: string | null
  requiredLevelRank: number | null
  isFree: boolean
  unlocked: boolean
  enrolled: boolean
  progressPct: number
  completedLessonIds: string[]
  learningObjectives: string[]
  purpose: string | null
  coverImageUrl: string | null
  modules: CourseModule[]
}

export interface ProgressResult {
  progressPct: number
  courseCompleted: boolean
}

export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: () => apiClient.get<CatalogItem[]>('/discipleship/catalog'),
  })
}

export function useCourse(slug: string) {
  return useQuery({
    queryKey: ['course', slug],
    queryFn: () => apiClient.get<CourseDetail>(`/discipleship/courses/${slug}`),
  })
}

export function useEnroll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (courseId: string) =>
      apiClient.post<{ id: string }>('/discipleship/enrollments', { courseId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['course'] })
    },
  })
}

export function useCompleteLesson(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lessonId: string) =>
      apiClient.post<ProgressResult>(`/discipleship/lessons/${lessonId}/complete`),
    onSuccess: () => {
      // La ficha ya trae `completedLessonIds` y `progressPct`: refrescarla
      // actualiza los checks y la barra sin un endpoint de progreso aparte.
      void qc.invalidateQueries({ queryKey: ['course', slug] })
      void qc.invalidateQueries({ queryKey: ['catalog'] })
    },
  })
}

export interface ResultadoExamen {
  resultados: boolean[]
  aciertos: number
  total: number
  aprobado: boolean
  progressPct: number | null
}

/** Califica una evaluación en el servidor (las respuestas correctas no salen al cliente). */
export function useGradeExam(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { lessonId: string; respuestas: number[] }) =>
      apiClient.post<ResultadoExamen>(`/discipleship/lessons/${input.lessonId}/grade`, {
        respuestas: input.respuestas,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['course', slug] })
      void qc.invalidateQueries({ queryKey: ['catalog'] })
    },
  })
}
