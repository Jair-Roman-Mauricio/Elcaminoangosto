import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CourseStatus, Level } from '@elcamino/shared-types'
import { apiClient } from '../../lib/api-client'
import type { CourseModule } from './api'

/* Contratos del flujo de autoría/aprobación (espejo del servidor). */

export interface AuthoringCourse {
  id: string
  teacherId: string
  title: string
  slug: string
  description: string | null
  requiredLevelRank: number | null
  isFree: boolean
  status: CourseStatus
  plannedModules: number
  /** Bloqueado por moderación (HU-7.2): inaccesible para los estudiantes. */
  blocked: boolean
}

export interface CourseReview {
  id: string
  decision: 'APPROVED' | 'REJECTED'
  reviewerName: string
  notes: string | null
  reviewedAt: string
}

export interface StudentView {
  id: string
  title: string
  description: string | null
  requiredLevelId: string | null
  requiredLevelRank: number | null
  isFree: boolean
  plannedModules: number
  learningObjectives: string[]
  purpose: string | null
  coverImageUrl: string | null
  status: CourseStatus
  /** Bloqueado por moderación (HU-7.2): inaccesible para los estudiantes. */
  blocked: boolean
  modules: CourseModule[]
}

// ── Maestro ─────────────────────────────────────────────────────────────

export function useMyCourses() {
  return useQuery({
    queryKey: ['my-courses'],
    queryFn: () => apiClient.get<AuthoringCourse[]>('/discipleship/my-courses'),
  })
}

export interface CourseCompletion {
  courseId: string
  title: string
  enrolled: number
  completed: number
}

/** Inscritos y completados por curso (dashboard del maestro). */
export function useCourseCompletions() {
  return useQuery({
    queryKey: ['course-completions'],
    queryFn: () => apiClient.get<CourseCompletion[]>('/discipleship/course-completions'),
  })
}

export function useLevels() {
  return useQuery({
    queryKey: ['niveles'],
    queryFn: () => apiClient.get<Level[]>('/users/levels'),
    staleTime: 10 * 60 * 1000,
  })
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      title: string
      description: string | null
      requiredLevelId: string
      isFree: true
      plannedModules: number
    }) =>
      apiClient.post<AuthoringCourse>('/discipleship/courses', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-courses'] }),
  })
}

export function useUpdateCourse(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      title?: string
      description?: string | null
      requiredLevelId?: string | null
      learningObjectives?: string[]
      purpose?: string | null
      coverImageUrl?: string | null
    }) => apiClient.patch<AuthoringCourse>(`/discipleship/courses/${courseId}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-courses'] })
      void qc.invalidateQueries({ queryKey: ['student-view', courseId] })
    },
  })
}

/** Publica un borrador con una llave del admin (sin pasar por revisión). */
export function usePublishWithKey(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      apiClient.post<AuthoringCourse>(`/discipleship/courses/${courseId}/publish-with-key`, { code }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-courses'] })
      void qc.invalidateQueries({ queryKey: ['student-view', courseId] })
    },
  })
}

export interface PublishKey {
  id: string
  code: string
  usedBy: string | null
  usedCourseId: string | null
  usedAt: string | null
  createdAt: string
}

/** Llaves de publicación (panel de admin). */
export function usePublishKeys() {
  return useQuery({
    queryKey: ['publish-keys'],
    queryFn: () => apiClient.get<PublishKey[]>('/discipleship/publish-keys'),
  })
}

export function useGeneratePublishKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<PublishKey>('/discipleship/publish-keys'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['publish-keys'] }),
  })
}

export function useAddModule(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (title: string) =>
      apiClient.post<{ moduleId: string }>(`/discipleship/courses/${courseId}/modules`, { title }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['student-view', courseId] }),
  })
}

interface NuevaLeccion {
  moduleId: string
  title: string
  type: 'TEXT' | 'VIDEO' | 'EXAM' | 'IMAGE'
  /** Requerido para TEXT. */
  content?: string | null
  /** Requerido para VIDEO: id del medio ya subido. */
  mediaAssetId?: string | null
  /** Requerido para EXAM. */
  questions?: { enunciado: string; opciones: string[]; correcta: number }[]
  durationSeconds?: number | null
}

export function useAddLesson(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      moduleId,
      title,
      type,
      content,
      mediaAssetId,
      questions,
      durationSeconds,
    }: NuevaLeccion) =>
      apiClient.post<{ lessonId: string }>(
        `/discipleship/courses/${courseId}/modules/${moduleId}/lessons`,
        {
          title,
          type,
          content: content ?? null,
          mediaAssetId: mediaAssetId ?? null,
          questions: questions ?? [],
          durationSeconds: durationSeconds ?? null,
        },
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['student-view', courseId] }),
  })
}

/** Acciones de estado del maestro: submit, back-to-draft, publish. */
export function useCourseAction(courseId: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['my-courses'] })
    void qc.invalidateQueries({ queryKey: ['student-view', courseId] })
    void qc.invalidateQueries({ queryKey: ['review-queue'] })
  }
  return {
    submit: useMutation({
      mutationFn: () => apiClient.post<AuthoringCourse>(`/discipleship/courses/${courseId}/submit`),
      onSuccess: invalidate,
    }),
    publish: useMutation({
      mutationFn: () => apiClient.post<AuthoringCourse>(`/discipleship/courses/${courseId}/publish`),
      onSuccess: invalidate,
    }),
    backToDraft: useMutation({
      mutationFn: () =>
        apiClient.post<AuthoringCourse>(`/discipleship/courses/${courseId}/back-to-draft`),
      onSuccess: invalidate,
    }),
  }
}

export function useStudentView(courseId: string, enabled = true) {
  return useQuery({
    queryKey: ['student-view', courseId],
    queryFn: () => apiClient.get<StudentView>(`/discipleship/courses/${courseId}/student-view`),
    enabled: enabled && Boolean(courseId),
  })
}

export function useCourseReviews(courseId: string, enabled = true) {
  return useQuery({
    queryKey: ['course-reviews', courseId],
    queryFn: () => apiClient.get<CourseReview[]>(`/discipleship/courses/${courseId}/reviews`),
    enabled,
  })
}

// ── Admin ───────────────────────────────────────────────────────────────

export function useReviewQueue() {
  return useQuery({
    queryKey: ['review-queue'],
    queryFn: () => apiClient.get<AuthoringCourse[]>('/discipleship/review-queue'),
  })
}

export type ObservationResource =
  | 'LESSON'
  | 'MODULE'
  | 'DESCRIPTION'
  | 'PURPOSE'
  | 'OBJECTIVES'
  | 'COVER'
  | 'COURSE'

export interface Observation {
  id: string
  courseId: string
  resourceType: ObservationResource
  resourceId: string | null
  note: string
  createdBy: string
  resolvedAt: string | null
  createdAt: string
}

/** Indicaciones de cambio de un curso (admin o maestro dueño). */
export function useObservations(courseId: string, enabled = true) {
  return useQuery({
    queryKey: ['observations', courseId],
    queryFn: () => apiClient.get<Observation[]>(`/discipleship/courses/${courseId}/observations`),
    enabled: enabled && Boolean(courseId),
  })
}

export function useAddObservation(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { resourceType: ObservationResource; resourceId?: string | null; note: string }) =>
      apiClient.post<Observation>(`/discipleship/courses/${courseId}/observations`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['observations', courseId] }),
  })
}

export function useDeleteObservation(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (obsId: string) => apiClient.delete(`/discipleship/observations/${obsId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['observations', courseId] }),
  })
}

// ── Moderación de cursos publicados (HU-7.2) ───────────────────────────────

export type ModerationStatus = 'APPROVED' | 'PENDING' | 'BLOCKED'

export interface ModerationCourse {
  id: string
  title: string
  slug: string
  blocked: boolean
  pendientes: number
  bloqueados: number
}

export type ModerationAction =
  'LESSON_APPROVED' | 'LESSON_PENDING' | 'LESSON_BLOCKED' | 'COURSE_BLOCKED' | 'COURSE_UNBLOCKED'

/** Una decisión de moderación registrada (auditoría). */
export interface ModerationLogEntry {
  id: string
  courseId: string
  lessonId: string | null
  lessonTitle: string | null
  action: ModerationAction
  moderatorId: string
  moderatorName: string
  createdAt: string
}

/** Cursos publicados con contenido pendiente/bloqueado (cola de moderación). */
export function useModerationQueue() {
  return useQuery({
    queryKey: ['moderation'],
    queryFn: () => apiClient.get<ModerationCourse[]>('/discipleship/moderation'),
  })
}

/** Bitácora de decisiones de moderación de un curso (admin o maestro dueño). */
export function useModerationLog(courseId: string, enabled = true) {
  return useQuery({
    queryKey: ['moderation-log', courseId],
    queryFn: () =>
      apiClient.get<ModerationLogEntry[]>(`/discipleship/courses/${courseId}/moderation-log`),
    enabled: enabled && Boolean(courseId),
  })
}

/**
 * Invalida todo lo que cambia tras moderar: la vista del curso, la cola y la
 * bitácora. Compartido por las dos mutaciones para no repetir la lista.
 */
function useInvalidarModeracion(courseId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['student-view', courseId] })
    void qc.invalidateQueries({ queryKey: ['moderation'] })
    void qc.invalidateQueries({ queryKey: ['moderation-log', courseId] })
  }
}

export function useModerateLesson(courseId: string) {
  const invalidar = useInvalidarModeracion(courseId)
  return useMutation({
    mutationFn: ({ lessonId, status }: { lessonId: string; status: ModerationStatus }) =>
      apiClient.post<ModerationLogEntry>(`/discipleship/lessons/${lessonId}/moderate`, { status }),
    onSuccess: invalidar,
  })
}

export function useBlockCourse(courseId: string) {
  const invalidar = useInvalidarModeracion(courseId)
  return useMutation({
    mutationFn: (blocked: boolean) =>
      apiClient.post<ModerationLogEntry>(`/discipleship/courses/${courseId}/block`, { blocked }),
    onSuccess: invalidar,
  })
}

export function useReviewActions(courseId: string) {
  const qc = useQueryClient()
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['review-queue'] })
  return {
    take: useMutation({
      mutationFn: () =>
        apiClient.post<AuthoringCourse>(`/discipleship/courses/${courseId}/take-review`),
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: (notes: string | null) =>
        apiClient.post<AuthoringCourse>(`/discipleship/courses/${courseId}/approve`, { notes }),
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: (input: { notes: string; lessonIds?: string[]; borrarTodo?: boolean }) =>
        apiClient.post<AuthoringCourse>(`/discipleship/courses/${courseId}/reject`, input),
      onSuccess: invalidate,
    }),
    publish: useMutation({
      mutationFn: () =>
        apiClient.post<AuthoringCourse>(`/discipleship/courses/${courseId}/publish`),
      onSuccess: invalidate,
    }),
  }
}
