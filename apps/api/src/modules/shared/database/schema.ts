import {
  pgTable,
  pgSchema,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  bigint,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

/**
 * Espejo tipado del esquema SQL de `supabase/migrations/`.
 * Fuente de verdad del modelo: arquitectura.md §7.
 *
 * Las migraciones SQL mandan. Si tocas este archivo, escribe la migración.
 */

// `auth.users` lo gestiona Supabase; solo lo referenciamos.
const authSchema = pgSchema('auth')
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
})

// ─── Enums ────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['ESTUDIANTE', 'MAESTRO', 'ADMIN'])
export const courseStatusEnum = pgEnum('course_status', [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
])
export const lessonTypeEnum = pgEnum('lesson_type', ['VIDEO', 'TEXT', 'EXAM', 'IMAGE'])
// Moderación de contenido en cursos ya publicados (HU-7.2): APPROVED = visible;
// PENDING = nuevo/cambiado, oculto al alumno hasta que el admin lo apruebe;
// BLOCKED = el admin pidió corregirlo, oculto hasta que el profesor lo cambie.
export const moderationStatusEnum = pgEnum('moderation_status', ['APPROVED', 'PENDING', 'BLOCKED'])
export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'ACTIVE',
  'COMPLETED',
  'DROPPED',
])
export const reviewDecisionEnum = pgEnum('review_decision', ['APPROVED', 'REJECTED'])
export const mediaKindEnum = pgEnum('media_kind', ['AUDIO', 'VIDEO', 'IMAGE'])
export const mediaStatusEnum = pgEnum('media_status', [
  'UPLOADED',
  'PROCESSING',
  'READY',
  'FAILED',
])
export const postTypeEnum = pgEnum('post_type', ['VIDEO', 'IMAGE'])
export const postStatusEnum = pgEnum('post_status', ['PUBLISHED', 'HIDDEN', 'REPORTED'])
export const videoStatusEnum = pgEnum('video_status', ['PUBLISHED', 'HIDDEN'])
/** Identidad visual de un álbum/canción en la pantalla de Alabanza. */
export const alabanzaTonoEnum = pgEnum('alabanza_tono', ['vino', 'marfil', 'azul'])
export const reportStatusEnum = pgEnum('report_status', ['PENDING', 'RESOLVED', 'DISMISSED'])
export const levelUpStatusEnum = pgEnum('level_up_status', ['PENDING', 'APPROVED', 'REJECTED'])
export const mentorshipStatusEnum = pgEnum('mentorship_status', ['ACTIVE', 'ENDED'])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

// ─── media (transversal; declarado primero por las FK) ────────────────────
export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull(),
  bucket: text('bucket').notNull(),
  path: text('path').notNull(),
  kind: mediaKindEnum('kind').notNull(),
  status: mediaStatusEnum('status').notNull().default('UPLOADED'),
  hlsPath: text('hls_path'),
  posterPath: text('poster_path'),
  durationSeconds: integer('duration_seconds'),
  bytes: bigint('bytes', { mode: 'number' }),
  ...timestamps,
})

// ─── Identidad y roles ────────────────────────────────────────────────────
export const levels = pgTable('levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  rank: integer('rank').notNull().unique(),
  description: text('description'),
  ...timestamps,
})

export const profiles = pgTable('profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull().default('ESTUDIANTE'),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  currentLevelId: uuid('current_level_id').references(() => levels.id, { onDelete: 'set null' }),
  ...timestamps,
})

export const mentorships = pgTable(
  'mentorships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mentorId: uuid('mentor_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    status: mentorshipStatusEnum('status').notNull().default('ACTIVE'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex('mentorships_mentor_student_uq').on(t.mentorId, t.studentId)],
)

// ─── Discipulado ──────────────────────────────────────────────────────────
export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    thumbnailAssetId: uuid('thumbnail_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    requiredLevelId: uuid('required_level_id').references(() => levels.id, {
      onDelete: 'set null',
    }),
    isFree: boolean('is_free').notNull().default(true),
    status: courseStatusEnum('status').notNull().default('DRAFT'),
    plannedModules: integer('planned_modules').notNull().default(0),
    learningObjectives: jsonb('learning_objectives').$type<string[]>().notNull().default([]),
    purpose: text('purpose'),
    coverImageUrl: text('cover_image_url'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    // Bloqueo definitivo por moderación: el curso deja de ser accesible (HU-7.2).
    blocked: boolean('blocked').notNull().default(false),
    ...timestamps,
  },
  (t) => [index('courses_status_idx').on(t.status), index('courses_teacher_idx').on(t.teacherId)],
)

export const courseModules = pgTable('course_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  orderIndex: integer('order_index').notNull(),
  ...timestamps,
})

export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id')
    .notNull()
    .references(() => courseModules.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: lessonTypeEnum('type').notNull(),
  content: text('content'),
  // Estado de moderación (HU-7.2). Nuevo/cambiado en curso publicado → PENDING.
  moderationStatus: moderationStatusEnum('moderation_status').notNull().default('APPROVED'),
  mediaAssetId: uuid('media_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
  questions: jsonb('questions').$type<import('@elcamino/shared-types').PreguntaExamen[]>().notNull().default([]),
  orderIndex: integer('order_index').notNull(),
  durationSeconds: integer('duration_seconds'),
  ...timestamps,
})

export const courseReviews = pgTable('course_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  reviewerId: uuid('reviewer_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  decision: reviewDecisionEnum('decision').notNull(),
  notes: text('notes'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
})

/**
 * Indicaciones de cambio del admin sobre recursos concretos de un curso en
 * revisión (HU-5.2). El profesor las ve en su editor, junto a cada recurso.
 * `resourceType`: LESSON | DESCRIPTION | PURPOSE | OBJECTIVES | COVER | MODULE |
 * COURSE. `resourceId` apunta a la lección/módulo; nulo para recursos del curso.
 */
export const contentObservations = pgTable(
  'content_observations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id'),
    note: text('note').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('content_observations_course_idx').on(t.courseId)],
)

/**
 * Bitácora de moderación (HU-7.2): cada decisión del admin sobre un curso ya
 * publicado. Es auditoría: se escribe una vez y no se edita ni se borra.
 * `lessonId` no lleva clave ajena a propósito — el registro sobrevive al
 * borrado de la lección, y `lessonTitle` conserva su nombre de entonces.
 */
export const moderationActions = pgTable(
  'moderation_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id'),
    lessonTitle: text('lesson_title'),
    action: text('action')
      .$type<
        | 'LESSON_APPROVED'
        | 'LESSON_PENDING'
        | 'LESSON_BLOCKED'
        | 'COURSE_BLOCKED'
        | 'COURSE_UNBLOCKED'
      >()
      .notNull(),
    moderatorId: uuid('moderator_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('moderation_actions_course_idx').on(t.courseId, t.createdAt)],
)

export const publishKeys = pgTable('publish_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  usedBy: uuid('used_by').references(() => profiles.id, { onDelete: 'set null' }),
  usedCourseId: uuid('used_course_id').references(() => courses.id, { onDelete: 'set null' }),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    status: enrollmentStatusEnum('status').notNull().default('ACTIVE'),
    progressPct: numeric('progress_pct', { precision: 5, scale: 2 }).notNull().default('0'),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex('enrollments_student_course_uq').on(t.studentId, t.courseId)],
)

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('lesson_progress_uq').on(t.enrollmentId, t.lessonId)],
)

// ─── Música ───────────────────────────────────────────────────────────────
export const artists = pgTable('artists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  bio: text('bio'),
  avatarAssetId: uuid('avatar_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
  ...timestamps,
})

export const albums = pgTable('albums', {
  id: uuid('id').primaryKey().defaultRandom(),
  artistId: uuid('artist_id')
    .notNull()
    .references(() => artists.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  coverAssetId: uuid('cover_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  // Presentación en Alabanza (HU-9.2): antes vivía en un fichero del cliente.
  number: text('number'),
  description: text('description'),
  coverImageUrl: text('cover_image_url'),
  tone: alabanzaTonoEnum('tone').notNull().default('vino'),
  discColor: text('disc_color'),
  ...timestamps,
})

export const songs = pgTable(
  'songs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    albumId: uuid('album_id').references(() => albums.id, { onDelete: 'set null' }),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    audioAssetId: uuid('audio_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
    durationSeconds: integer('duration_seconds'),
    isPublished: boolean('is_published').notNull().default(false),
    // Presentación en Alabanza (HU-9.2).
    trackNumber: integer('track_number'),
    subtitle: text('subtitle'),
    tone: alabanzaTonoEnum('tone').notNull().default('vino'),
    /** Fondo de imagen: URL pública. */
    backgroundUrl: text('background_url'),
    /** Fondo de video: medio privado, servido firmado. */
    backgroundAssetId: uuid('background_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    /** `imagen` | `video`: qué se ve mientras suena. */
    backgroundType: text('background_type').$type<'imagen' | 'video'>(),
    /** Contenido del `.srt` con la letra; el cliente lo interpreta. */
    subtitlesSrt: text('subtitles_srt'),
    ...timestamps,
  },
  (t) => [
    index('songs_published_idx').on(t.isPublished),
    index('songs_album_track_idx').on(t.albumId, t.trackNumber),
  ],
)

export const playlists = pgTable('playlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  ...timestamps,
})

export const playlistSongs = pgTable(
  'playlist_songs',
  {
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.playlistId, t.songId] })],
)

export const songPlays = pgTable('song_plays', {
  id: uuid('id').primaryKey().defaultRandom(),
  songId: uuid('song_id')
    .notNull()
    .references(() => songs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  playedAt: timestamp('played_at', { withTimezone: true }).notNull().defaultNow(),
})

export const songLikes = pgTable(
  'song_likes',
  {
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.songId, t.userId] })],
)

// ─── Feed (Tarjetas de Fe) ────────────────────────────────────────────────
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    type: postTypeEnum('type').notNull(),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    caption: text('caption'),
    // Ficha de la tarjeta: lo que se lee en el lienzo del feed. Opcional para
    // no invalidar las tarjetas anteriores, que solo tenían `caption`.
    title: text('title'),
    manifesto: text('manifesto'),
    /** Relato; los párrafos se separan con una línea en blanco. */
    story: text('story'),
    origin: text('origin'),
    reference: text('reference'),
    audioAssetId: uuid('audio_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    status: postStatusEnum('status').notNull().default('PUBLISHED'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('posts_status_published_idx').on(t.status, t.publishedAt)],
)

/**
 * Videos cristianos (HU-9.3). El archivo vive en `media_assets`: un video solo
 * se ve cuando su medio está READY.
 */
export const videos = pgTable(
  'videos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    series: text('series'),
    description: text('description'),
    reference: text('reference'),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    status: videoStatusEnum('status').notNull().default('PUBLISHED'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('videos_status_published_idx').on(t.status, t.publishedAt)],
)

export const postLikes = pgTable(
  'post_likes',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
)

export const postComments = pgTable('post_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  ...timestamps,
})

export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    followeeId: uuid('followee_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] })],
)

export const postReports = pgTable('post_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  reporterId: uuid('reporter_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  status: reportStatusEnum('status').notNull().default('PENDING'),
  ...timestamps,
})

// ─── Chat y niveles ───────────────────────────────────────────────────────
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mentorId: uuid('mentor_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('conversations_pair_uq').on(t.mentorId, t.studentId)],
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.createdAt)],
)

export const levelUpRequests = pgTable('level_up_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  mentorId: uuid('mentor_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  fromLevelId: uuid('from_level_id').references(() => levels.id, { onDelete: 'set null' }),
  toLevelId: uuid('to_level_id')
    .notNull()
    .references(() => levels.id, { onDelete: 'restrict' }),
  message: text('message'),
  status: levelUpStatusEnum('status').notNull().default('PENDING'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  ...timestamps,
})

// ─── Notificaciones ───────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  readAt: timestamp('read_at', { withTimezone: true }),
  ...timestamps,
})
