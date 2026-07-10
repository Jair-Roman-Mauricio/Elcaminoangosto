-- ═══════════════════════════════════════════════════════════════════════════
-- Esquema inicial — El Camino Angosto
-- Modelo de datos: docs/arquitectura.md §7
-- RLS se activa en la migración 20260709000200_rls.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────────────
create type public.role as enum ('ESTUDIANTE', 'MAESTRO', 'ADMIN');

create type public.course_status as enum (
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED'
);

create type public.lesson_type        as enum ('VIDEO', 'TEXT');
create type public.enrollment_status  as enum ('ACTIVE', 'COMPLETED', 'DROPPED');
create type public.review_decision    as enum ('APPROVED', 'REJECTED');
create type public.media_kind         as enum ('AUDIO', 'VIDEO', 'IMAGE');
create type public.media_status       as enum ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');
create type public.post_type          as enum ('VIDEO', 'IMAGE');
create type public.post_status        as enum ('PUBLISHED', 'HIDDEN', 'REPORTED');
create type public.report_status      as enum ('PENDING', 'RESOLVED', 'DISMISSED');
create type public.level_up_status    as enum ('PENDING', 'APPROVED', 'REJECTED');
create type public.mentorship_status  as enum ('ACTIVE', 'ENDED');

-- ─── `updated_at` automático ───────────────────────────────────────────────
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Medios (transversal; primero por las FK) ──────────────────────────────
create table public.media_assets (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  bucket           text not null,
  path             text not null,
  kind             public.media_kind not null,
  status           public.media_status not null default 'UPLOADED',
  hls_path         text,
  poster_path      text,
  duration_seconds integer,
  bytes            bigint,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint media_assets_bucket_path_uq unique (bucket, path)
);
create index media_assets_owner_idx  on public.media_assets (owner_id);
create index media_assets_status_idx on public.media_assets (status);

-- ─── Identidad, roles y niveles ────────────────────────────────────────────
create table public.levels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  rank        integer not null unique check (rank > 0),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  role             public.role not null default 'ESTUDIANTE',
  display_name     text not null check (char_length(display_name) between 1 and 60),
  avatar_url       text,
  bio              text check (bio is null or char_length(bio) <= 500),
  current_level_id uuid references public.levels (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

create table public.mentorships (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status     public.mentorship_status not null default 'ACTIVE',
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentorships_mentor_student_uq unique (mentor_id, student_id),
  constraint mentorships_no_autotutela     check (mentor_id <> student_id)
);
create index mentorships_student_idx on public.mentorships (student_id);

-- ─── Discipulado ───────────────────────────────────────────────────────────
create table public.courses (
  id                 uuid primary key default gen_random_uuid(),
  teacher_id         uuid not null references public.profiles (id) on delete restrict,
  title              text not null check (char_length(title) between 3 and 120),
  slug               text not null unique,
  description        text,
  thumbnail_asset_id uuid references public.media_assets (id) on delete set null,
  required_level_id  uuid references public.levels (id) on delete set null,
  is_free            boolean not null default true,
  status             public.course_status not null default 'DRAFT',
  planned_modules    integer not null default 0 check (planned_modules >= 0),
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Invariante: un curso PUBLISHED siempre tiene fecha de publicación.
  constraint courses_published_tiene_fecha
    check (status <> 'PUBLISHED' or published_at is not null)
);
create index courses_status_idx  on public.courses (status);
create index courses_teacher_idx on public.courses (teacher_id);
create index courses_level_idx   on public.courses (required_level_id);

create table public.course_modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null,
  order_index integer not null check (order_index >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint course_modules_orden_uq unique (course_id, order_index)
);

create table public.lessons (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid not null references public.course_modules (id) on delete cascade,
  title            text not null,
  type             public.lesson_type not null,
  content          text,
  media_asset_id   uuid references public.media_assets (id) on delete set null,
  order_index      integer not null check (order_index >= 0),
  duration_seconds integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lessons_orden_uq unique (module_id, order_index),
  -- Una lección de video necesita su medio; una de texto, su contenido.
  constraint lessons_contenido_coherente check (
    (type = 'VIDEO' and media_asset_id is not null) or
    (type = 'TEXT'  and content is not null)
  )
);

create table public.course_reviews (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  decision    public.review_decision not null,
  notes       text,
  reviewed_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- HU-5.2: un rechazo siempre lleva notas para el maestro.
  constraint course_reviews_rechazo_con_notas
    check (decision <> 'REJECTED' or (notes is not null and char_length(notes) > 0))
);
create index course_reviews_course_idx on public.course_reviews (course_id);

create table public.enrollments (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  course_id    uuid not null references public.courses (id) on delete cascade,
  status       public.enrollment_status not null default 'ACTIVE',
  progress_pct numeric(5,2) not null default 0 check (progress_pct between 0 and 100),
  enrolled_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint enrollments_student_course_uq unique (student_id, course_id)
);
create index enrollments_course_idx on public.enrollments (course_id);

create table public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lesson_progress_uq unique (enrollment_id, lesson_id)
);

-- ─── Alabanza (música) ─────────────────────────────────────────────────────
create table public.artists (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  bio             text,
  avatar_asset_id uuid references public.media_assets (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.albums (
  id             uuid primary key default gen_random_uuid(),
  artist_id      uuid not null references public.artists (id) on delete cascade,
  title          text not null,
  cover_asset_id uuid references public.media_assets (id) on delete set null,
  released_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.songs (
  id               uuid primary key default gen_random_uuid(),
  album_id         uuid references public.albums (id) on delete set null,
  artist_id        uuid not null references public.artists (id) on delete cascade,
  title            text not null,
  audio_asset_id   uuid references public.media_assets (id) on delete set null,
  duration_seconds integer,
  is_published     boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index songs_published_idx on public.songs (is_published);
create index songs_artist_idx    on public.songs (artist_id);

create table public.playlists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  is_public  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.playlist_songs (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  song_id     uuid not null references public.songs (id) on delete cascade,
  order_index integer not null check (order_index >= 0),
  created_at  timestamptz not null default now(),
  primary key (playlist_id, song_id)
);

create table public.song_plays (
  id        uuid primary key default gen_random_uuid(),
  song_id   uuid not null references public.songs (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  played_at timestamptz not null default now()
);
create index song_plays_song_idx on public.song_plays (song_id, played_at desc);

create table public.song_likes (
  song_id    uuid not null references public.songs (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (song_id, user_id)
);

-- ─── Tarjetas de Fe (feed) ─────────────────────────────────────────────────
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles (id) on delete cascade,
  type           public.post_type not null,
  media_asset_id uuid not null references public.media_assets (id) on delete restrict,
  caption        text check (caption is null or char_length(caption) <= 500),
  status         public.post_status not null default 'PUBLISHED',
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index posts_feed_idx   on public.posts (status, published_at desc);
create index posts_author_idx on public.posts (author_id);

create table public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_autoseguimiento check (follower_id <> followee_id)
);

create table public.post_reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null,
  status      public.report_status not null default 'PENDING',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint post_reports_uq unique (post_id, reporter_id)
);
create index post_reports_status_idx on public.post_reports (status);

-- ─── Chat y niveles ────────────────────────────────────────────────────────
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  mentor_id       uuid not null references public.profiles (id) on delete cascade,
  student_id      uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint conversations_pair_uq unique (mentor_id, student_id),
  constraint conversations_no_autochat check (mentor_id <> student_id)
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.level_up_requests (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles (id) on delete cascade,
  mentor_id     uuid not null references public.profiles (id) on delete cascade,
  from_level_id uuid references public.levels (id) on delete set null,
  to_level_id   uuid not null references public.levels (id) on delete restrict,
  message       text,
  status        public.level_up_status not null default 'PENDING',
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint level_up_resuelta_tiene_fecha
    check (status = 'PENDING' or resolved_at is not null)
);
create index level_up_requests_mentor_idx on public.level_up_requests (mentor_id, status);
-- Una sola solicitud pendiente por estudiante a la vez.
create unique index level_up_requests_una_pendiente
  on public.level_up_requests (student_id) where (status = 'PENDING');

-- ─── Notificaciones ────────────────────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at);

-- ─── Triggers de `updated_at` ──────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'media_assets','levels','profiles','mentorships','courses','course_modules','lessons',
    'course_reviews','enrollments','lesson_progress','artists','albums','songs','playlists',
    'posts','post_comments','post_reports','conversations','messages','level_up_requests',
    'notifications'
  ]
  loop
    execute format(
      'create trigger %I_tocar_updated_at before update on public.%I
       for each row execute function public.tocar_updated_at()', t, t
    );
  end loop;
end;
$$;

-- ─── Aprovisionamiento del perfil al registrarse (HU-0.2) ──────────────────
-- Todo usuario nuevo nace ESTUDIANTE. El rol solo lo cambia un ADMIN.
create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    ),
    'ESTUDIANTE'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();
