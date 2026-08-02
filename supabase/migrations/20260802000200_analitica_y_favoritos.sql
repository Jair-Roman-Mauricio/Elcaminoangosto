-- Analítica de contenido y favoritos en la cuenta.
--
-- FAVORITOS. Guardar canciones dejaba de vivir en el navegador y pasa a la
-- cuenta, así que exige sesión. Las tablas ya existían sin uso: `song_likes`
-- para las canciones sueltas y `playlists` (+ `playlist_songs`) para los
-- álbumes personales. Solo les falta la portada que el cliente ya mostraba.
--
-- ANALÍTICA. Dos tablas y una regla de privacidad (RNF-9): se guarda un
-- identificador ALEATORIO de sesión de navegador, nunca IP ni huella. Sirve
-- para distinguir «una persona que entra diez veces» de «diez personas», y
-- caduca cuando esa sesión termina. Si más tarde la persona inicia sesión,
-- `viewer_id` permite ver cuántos visitantes acaban registrándose.

alter table public.playlists
  add column if not exists cover_url text;

comment on column public.playlists.cover_url is 'Portada del álbum personal';

-- ─── Vistas de contenido ───────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'content_kind') then
    create type content_kind as enum ('VIDEO', 'POST', 'SONG');
  end if;
end $$;

create table if not exists public.content_views (
  id         uuid primary key default gen_random_uuid(),
  kind       content_kind not null,
  -- Sin clave ajena a propósito: la vista es un hecho ocurrido y debe
  -- sobrevivir a que se elimine el contenido. Los informes cruzan por id.
  content_id uuid not null,
  viewer_id  uuid references public.profiles (id) on delete set null,
  /** Identificador aleatorio de sesión de navegador. Nunca IP ni huella. */
  session_id text not null,
  created_at timestamptz not null default now()
);

-- Rankings («los más vistos») y series por fecha.
create index if not exists content_views_kind_fecha_idx
  on public.content_views (kind, created_at desc);
create index if not exists content_views_contenido_idx
  on public.content_views (kind, content_id);

-- ─── Visitas a la plataforma ───────────────────────────────────────────────
create table if not exists public.site_visits (
  id         uuid primary key default gen_random_uuid(),
  /** Sección abierta: landing, alabanza, videos, tarjetas, discipulado… */
  section    text not null,
  /** Nulo mientras la persona no tiene sesión: es el flujo que se quiere ver. */
  viewer_id  uuid references public.profiles (id) on delete set null,
  session_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists site_visits_fecha_idx on public.site_visits (created_at desc);
create index if not exists site_visits_seccion_idx on public.site_visits (section, created_at desc);
-- Para contar visitantes distintos sin recorrer toda la tabla.
create index if not exists site_visits_sesion_idx on public.site_visits (session_id, created_at desc);

alter table public.content_views enable row level security;
alter table public.content_views force row level security;
alter table public.site_visits enable row level security;
alter table public.site_visits force row level security;

-- Solo el admin lee la analítica. Quien escribe es el API con la service_role,
-- que no pasa por estas políticas: así un visitante no puede inflar los
-- contadores llamando a Supabase por su cuenta.
create policy content_views_admin on public.content_views
  for select to authenticated using (public.es_admin());
create policy site_visits_admin on public.site_visits
  for select to authenticated using (public.es_admin());
