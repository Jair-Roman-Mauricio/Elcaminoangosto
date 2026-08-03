-- La plataforma deja de tener alumnos y profesores.
--
-- A partir de aquí solo existe la cuenta de administración; todo el contenido
-- —tarjetas, videos y alabanza— es libre para cualquiera, sin registrarse.
--
-- Eso deja sin sentido bloques enteros del modelo, que se borran con sus datos
-- (decisión explícita, no reversible):
--
--   · Discipulado: cursos, módulos, lecciones, inscripciones, progreso,
--     revisiones, moderación y claves de publicación.
--   · Mentoría y chat: la conversación era siempre entre un mentor y su
--     estudiante; sin esos papeles no queda nadie a ambos lados.
--   · Niveles: ordenaban el acceso de los estudiantes al contenido.
--   · Notificaciones: las tres clases que existían avisaban de cursos
--     enviados, revisados o moderados.
--   · Seguimientos entre personas: sin cuentas no hay a quién seguir.
--
-- Lo que NO se toca: la música, las tarjetas de fe, los videos, la analítica
-- y las cuentas existentes en `auth.users`. Las cuentas que no son ADMIN se
-- quedan por si algún día se quiere algo con ellas; sin pantalla de entrada
-- pública y con el panel cerrado a ADMIN, no pueden llegar a ninguna parte.

-- ─── 1. Discipulado ────────────────────────────────────────────────────────
-- De las hojas hacia la raíz: sin `cascade`, para que un olvido salte como
-- error en vez de arrastrar en silencio algo que sí queríamos conservar.
drop table if exists public.lesson_progress;
drop table if exists public.enrollments;
drop table if exists public.course_reviews;
drop table if exists public.publish_keys;
drop table if exists public.content_observations;
drop table if exists public.moderation_actions;
drop table if exists public.lessons;
drop table if exists public.course_modules;
drop table if exists public.courses;

-- ─── 2. Mentoría y chat ────────────────────────────────────────────────────
drop table if exists public.mentorships;
drop table if exists public.messages;
drop table if exists public.conversations;

-- ─── 3. Notificaciones, seguimientos e interacción con cuenta ──────────────
drop table if exists public.notifications;
drop table if exists public.follows;

-- Comentarios, «me gusta» y reportes de tarjetas: colgaban de una cuenta y
-- ninguna pantalla llegó a usarlos. Sin registro no hay a quién atribuirlos.
drop table if exists public.post_comments;
drop table if exists public.post_likes;
drop table if exists public.post_reports;

-- ─── 4. Niveles ────────────────────────────────────────────────────────────
drop table if exists public.level_up_requests;

drop trigger if exists asegurar_nivel_base_estudiante on public.profiles;
drop function if exists public.asegurar_nivel_base_estudiante();

alter table public.profiles drop column if exists current_level_id;
drop table if exists public.levels;

-- ─── 5. Alta de cuentas ────────────────────────────────────────────────────
-- El perfil ya no arrastra nivel. El rol por defecto sigue siendo el de menor
-- privilegio: una cuenta nueva no debe nacer pudiendo administrar.
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

-- Se conserva el enum `role` con sus tres valores: quitarle elementos exige
-- recrear el tipo y todas las columnas que lo usan, y no compra nada. Lo que
-- importa es que solo ADMIN abre puertas; el resto ya no significa nada.

-- ─── 6. Funciones que solo servían al discipulado ──────────────────────────
drop function if exists public.nivel_actual();
drop function if exists public.esta_inscrito(uuid);
drop function if exists public.es_dueno_del_curso(uuid);

-- ─── 7. Contenido libre para todos ─────────────────────────────────────────
-- Las políticas de lectura estaban dadas `to authenticated`: sin sesión no se
-- leía nada. Ahora alcanzan también a `anon`, que es quien entra sin cuenta.
-- Escribir sigue siendo cosa del admin: solo cambia el SELECT.

drop policy if exists artists_leer on public.artists;
create policy artists_leer on public.artists
  for select to anon, authenticated using (true);

drop policy if exists albums_leer on public.albums;
create policy albums_leer on public.albums
  for select to anon, authenticated using (true);

drop policy if exists songs_leer on public.songs;
create policy songs_leer on public.songs
  for select to anon, authenticated using (is_published or public.es_admin());

drop policy if exists videos_leer on public.videos;
create policy videos_leer on public.videos
  for select to anon, authenticated using (status = 'PUBLISHED' or public.es_admin());

-- `author_id` deja de importar: ya no hay quien publique salvo el admin.
drop policy if exists posts_leer on public.posts;
drop policy if exists posts_crear on public.posts;
drop policy if exists posts_editar_los_mios on public.posts;
create policy posts_leer on public.posts
  for select to anon, authenticated using (status = 'PUBLISHED' or public.es_admin());

drop policy if exists media_assets_leer on public.media_assets;
create policy media_assets_leer on public.media_assets
  for select to anon, authenticated using (true);

-- ─── 8. Favoritos sin cuenta, recuperables con un código ───────────────────
-- Quien guarda música no tiene cuenta, así que su colección se ata a un código
-- que elige al crear su primer álbum. Con ese código la recupera en cualquier
-- dispositivo; sin él, se queda en el navegador donde la hizo.
--
-- El código NO se guarda: se guarda su huella sha256. Si la base se filtra,
-- nadie puede leer los códigos de nadie. La huella es determinista a propósito
-- —hay que poder buscar por ella— y por eso la app exige una longitud mínima:
-- un código corto sería adivinable a fuerza de intentos.

create table if not exists public.colecciones (
  id uuid primary key default gen_random_uuid(),
  codigo_huella text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coleccion_favoritos (
  coleccion_id uuid not null references public.colecciones(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coleccion_id, song_id)
);

create table if not exists public.coleccion_albumes (
  id uuid primary key default gen_random_uuid(),
  coleccion_id uuid not null references public.colecciones(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 80),
  portada_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coleccion_album_canciones (
  album_id uuid not null references public.coleccion_albumes(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  orden int not null default 0,
  primary key (album_id, song_id)
);

create index if not exists coleccion_albumes_por_coleccion
  on public.coleccion_albumes (coleccion_id);

create trigger colecciones_tocar_updated_at
  before update on public.colecciones
  for each row execute function public.tocar_updated_at();

create trigger coleccion_albumes_tocar_updated_at
  before update on public.coleccion_albumes
  for each row execute function public.tocar_updated_at();

-- Nadie llega a estas tablas por PostgREST: se entra por el API, que conoce el
-- código. Sin políticas y con RLS activo, quedan cerradas a anon y a
-- authenticated, que es exactamente lo que se quiere.
alter table public.colecciones enable row level security;
alter table public.coleccion_favoritos enable row level security;
alter table public.coleccion_albumes enable row level security;
alter table public.coleccion_album_canciones enable row level security;

-- Las listas de la etapa anterior, atadas a cuentas, ya no tienen dueño.
drop table if exists public.playlist_songs;
drop table if exists public.playlists;
drop table if exists public.song_likes;

-- ─── 9. Permiso de tabla para quien no tiene cuenta ────────────────────────
-- Una política no concede nada por sí sola: primero hace falta el GRANT. El rol
-- `anon` solo tenía permisos residuales (TRIGGER, REFERENCES), así que sin esto
-- un visitante recibiría «permission denied» y la plataforma abierta se vería
-- vacía para todo el mundo que no iniciara sesión.
grant select on public.posts        to anon;
grant select on public.videos       to anon;
grant select on public.songs        to anon;
grant select on public.albums       to anon;
grant select on public.artists      to anon;
grant select on public.media_assets to anon;
