import { z } from 'zod'
import { RoleSchema } from './roles'
import { CourseStatusSchema } from './course-status'

/** Modelo de datos de arquitectura.md §7, expuesto como contrato al front. */

export const LevelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  rank: z.number().int().positive(),
  description: z.string().nullable(),
})
export type Level = z.infer<typeof LevelSchema>

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  role: RoleSchema,
  displayName: z.string().min(1).max(60),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().max(500).nullable(),
  currentLevelId: z.string().uuid().nullable(),
})
export type Profile = z.infer<typeof ProfileSchema>

export const UpdateProfileSchema = ProfileSchema.pick({
  displayName: true,
  avatarUrl: true,
  bio: true,
}).partial()
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>

export const CourseSchema = z.object({
  id: z.string().uuid(),
  teacherId: z.string().uuid(),
  title: z.string().min(3).max(120),
  slug: z.string(),
  description: z.string().nullable(),
  thumbnailAssetId: z.string().uuid().nullable(),
  requiredLevelId: z.string().uuid().nullable(),
  isFree: z.boolean(),
  status: CourseStatusSchema,
  plannedModules: z.number().int().nonnegative(),
})
export type Course = z.infer<typeof CourseSchema>

export const LessonTypeSchema = z.enum(['VIDEO', 'TEXT'])
export type LessonType = z.infer<typeof LessonTypeSchema>

export const LessonSchema = z.object({
  id: z.string().uuid(),
  moduleId: z.string().uuid(),
  title: z.string().min(1).max(120),
  type: LessonTypeSchema,
  content: z.string().nullable(),
  mediaAssetId: z.string().uuid().nullable(),
  orderIndex: z.number().int().nonnegative(),
  durationSeconds: z.number().int().nonnegative().nullable(),
})
export type Lesson = z.infer<typeof LessonSchema>

export const EnrollmentStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'DROPPED'])
export type EnrollmentStatus = z.infer<typeof EnrollmentStatusSchema>

export const EnrollmentSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
  status: EnrollmentStatusSchema,
  progressPct: z.number().min(0).max(100),
})
export type Enrollment = z.infer<typeof EnrollmentSchema>

export const PostTypeSchema = z.enum(['VIDEO', 'IMAGE'])
export const PostStatusSchema = z.enum(['PUBLISHED', 'HIDDEN', 'REPORTED'])

export const PostSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  type: PostTypeSchema,
  mediaAssetId: z.string().uuid(),
  caption: z.string().max(500).nullable(),
  status: PostStatusSchema,
})
export type Post = z.infer<typeof PostSchema>

export const LevelUpRequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED'])
export type LevelUpRequestStatus = z.infer<typeof LevelUpRequestStatusSchema>
