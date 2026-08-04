import {
  pgTable,
  pgSchema,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  bigint,
  primaryKey,
  index,
  type AnyPgColumn,
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
/** Qué se mira: un video, una Tarjeta de Fe o una canción. */
export const contentKindEnum = pgEnum('content_kind', ['VIDEO', 'POST', 'SONG'])
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

export const profiles = pgTable('profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull().default('ESTUDIANTE'),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  ...timestamps,
})

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

// ─── Analítica ────────────────────────────────────────────────────────────
/**
 * Vista de una pieza de contenido público. `contentId` va sin clave ajena a
 * propósito: la vista es un hecho ocurrido y sobrevive a que se borre el
 * contenido. `sessionId` es aleatorio por sesión de navegador: nunca IP ni
 * huella (RNF-9).
 */
export const contentViews = pgTable(
  'content_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: contentKindEnum('kind').notNull(),
    contentId: uuid('content_id').notNull(),
    viewerId: uuid('viewer_id').references(() => profiles.id, { onDelete: 'set null' }),
    sessionId: text('session_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('content_views_kind_fecha_idx').on(t.kind, t.createdAt),
    index('content_views_contenido_idx').on(t.kind, t.contentId),
  ],
)

/** Entrada a una sección. `viewerId` nulo = visitante sin cuenta. */
export const siteVisits = pgTable(
  'site_visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    section: text('section').notNull(),
    viewerId: uuid('viewer_id').references(() => profiles.id, { onDelete: 'set null' }),
    sessionId: text('session_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('site_visits_fecha_idx').on(t.createdAt),
    index('site_visits_seccion_idx').on(t.section, t.createdAt),
    index('site_visits_sesion_idx').on(t.sessionId, t.createdAt),
  ],
)

// ─── Colecciones (favoritos sin cuenta) ───────────────────────────────────
// Quien guarda música no se registra: su colección se ata a un código que
// elige, y del que aquí solo vive la huella. Ver la migración
// `20260803000100_solo_admin_y_contenido_libre.sql`.
export const colecciones = pgTable('colecciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigoHuella: text('codigo_huella').notNull().unique(),
  ...timestamps,
})

export const coleccionFavoritos = pgTable(
  'coleccion_favoritos',
  {
    coleccionId: uuid('coleccion_id')
      .notNull()
      .references(() => colecciones.id, { onDelete: 'cascade' }),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.coleccionId, t.songId] })],
)

export const coleccionAlbumes = pgTable('coleccion_albumes', {
  id: uuid('id').primaryKey().defaultRandom(),
  coleccionId: uuid('coleccion_id')
    .notNull()
    .references(() => colecciones.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  portadaUrl: text('portada_url'),
  ...timestamps,
})

export const coleccionAlbumCanciones = pgTable(
  'coleccion_album_canciones',
  {
    albumId: uuid('album_id')
      .notNull()
      .references(() => coleccionAlbumes.id, { onDelete: 'cascade' }),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    orden: integer('orden').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.albumId, t.songId] })],
)

// ─── Comunidad ────────────────────────────────────────────────────────────
// Hilos abiertos sin cuentas: el autor es la huella de un identificador
// aleatorio del navegador. Ver `20260803000200_comunidad.sql`.
export const estadoPublicacionEnum = pgEnum('estado_publicacion', ['VISIBLE', 'OCULTO'])

export const hilos = pgTable('hilos', {
  id: uuid('id').primaryKey().defaultRandom(),
  titulo: text('titulo').notNull(),
  cuerpo: text('cuerpo').notNull(),
  autorHuella: text('autor_huella').notNull(),
  estado: estadoPublicacionEnum('estado').notNull().default('VISIBLE'),
  respuestas: integer('respuestas').notNull().default(0),
  ultimaActividad: timestamp('ultima_actividad', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
})

export const hiloRespuestas = pgTable('hilo_respuestas', {
  id: uuid('id').primaryKey().defaultRandom(),
  hiloId: uuid('hilo_id')
    .notNull()
    .references(() => hilos.id, { onDelete: 'cascade' }),
  /* Respuesta a la que contesta esta; nula si contesta al hilo. Un solo nivel:
     lo garantiza el trigger `hilo_respuestas_un_solo_nivel`. */
  respuestaPadreId: uuid('respuesta_padre_id').references(
    (): AnyPgColumn => hiloRespuestas.id,
    { onDelete: 'cascade' },
  ),
  cuerpo: text('cuerpo').notNull(),
  autorHuella: text('autor_huella').notNull(),
  estado: estadoPublicacionEnum('estado').notNull().default('VISIBLE'),
  ...timestamps,
})
