/**
 * Eventos de dominio in-process (arquitectura.md §2).
 *
 * Único canal de comunicación entre módulos junto a los servicios públicos.
 * Los nombres son estables: al extraer un módulo a servicio propio, estos
 * mismos nombres viajan por el broker sin tocar emisores ni consumidores.
 */
export const DOMAIN_EVENTS = {
  // users
  USER_LEVEL_CHANGED: 'user.level_changed',
  // discipleship
  COURSE_SUBMITTED: 'course.submitted',
  COURSE_PUBLISHED: 'course.published',
  LESSON_COMPLETED: 'lesson.completed',
  // admin
  COURSE_REVIEWED: 'course.reviewed',
  // chat
  LEVEL_UP_REQUESTED: 'level_up.requested',
  LEVEL_UP_REQUEST_APPROVED: 'level_up.approved',
  // media
  MEDIA_UPLOAD_REQUESTED: 'media.upload_requested',
  MEDIA_ASSET_READY: 'media.asset_ready',
  MEDIA_ASSET_FAILED: 'media.asset_failed',
  // music
  SONG_PLAYED: 'song.played',
  // feed
  POST_PUBLISHED: 'post.published',
  POST_REPORTED: 'post.reported',
} as const

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS]

export interface UserLevelChangedEvent {
  userId: string
  fromLevelRank: number
  toLevelRank: number
}

export interface CourseSubmittedEvent {
  courseId: string
  teacherId: string
}

export interface CoursePublishedEvent {
  courseId: string
  requiredLevelRank: number
}

export interface CourseReviewedEvent {
  courseId: string
  teacherId: string
  decision: 'APPROVED' | 'REJECTED'
}

export interface LessonCompletedEvent {
  enrollmentId: string
  lessonId: string
  studentId: string
}

export interface LevelUpRequestedEvent {
  requestId: string
  studentId: string
  mentorId: string
}

export interface LevelUpRequestApprovedEvent {
  requestId: string
  studentId: string
  toLevelId: string
}

export interface MediaUploadRequestedEvent {
  assetId: string
  bucket: string
  path: string
  kind: 'AUDIO' | 'VIDEO' | 'IMAGE'
}

export interface MediaAssetReadyEvent {
  assetId: string
  hlsPath: string | null
  posterPath: string | null
  durationSeconds: number | null
}

export interface MediaAssetFailedEvent {
  assetId: string
  reason: string
}

export interface PostReportedEvent {
  postId: string
  reportId: string
  reporterId: string
}
