import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CourseStatus } from '@elcamino/shared-types'
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
  status: CourseStatus
  modules: CourseModule[]
}

// ── Maestro ─────────────────────────────────────────────────────────────

export function useMyCourses() {
  return useQuery({
    queryKey: ['my-courses'],
    queryFn: () => apiClient.get<AuthoringCourse[]>('/discipleship/my-courses'),
  })
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { title: string; description: string | null }) =>
      apiClient.post<AuthoringCourse>('/discipleship/courses', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-courses'] }),
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

export function useAddLesson(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { moduleId: string; title: string; content: string }) =>
      apiClient.post<{ lessonId: string }>(
        `/discipleship/courses/${courseId}/modules/${input.moduleId}/lessons`,
        { title: input.title, type: 'TEXT', content: input.content },
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

export function useStudentView(courseId: string) {
  return useQuery({
    queryKey: ['student-view', courseId],
    queryFn: () => apiClient.get<StudentView>(`/discipleship/courses/${courseId}/student-view`),
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
      mutationFn: (notes: string) =>
        apiClient.post<AuthoringCourse>(`/discipleship/courses/${courseId}/reject`, { notes }),
      onSuccess: invalidate,
    }),
    publish: useMutation({
      mutationFn: () =>
        apiClient.post<AuthoringCourse>(`/discipleship/courses/${courseId}/publish`),
      onSuccess: invalidate,
    }),
  }
}
