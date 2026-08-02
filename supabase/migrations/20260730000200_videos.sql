-- Videos cristianos (HU-9.3).
--
-- Hasta ahora la sección era una lista escrita en el código del cliente. Esta
-- tabla la convierte en contenido real que el ADMIN publica y administra desde
-- el módulo Contenido.
--
-- El archivo vive en `media_assets` (pipeline de medios, E8): el video solo se
-- ve cuando su medio está READY, igual que una Tarjeta de Fe.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'video_status') then
    create type video_status as enum ('PUBLISHED', 'HIDDEN');
  end if;
end $$;

create table if not exists public.videos (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  /** Serie o colección a la que pertenece. */
  series         text,
  description    text,
  /** Referencia bíblica, si la tiene. */
  reference      text,
  media_asset_id uuid not null references public.media_assets (id) on delete restrict,
  status         video_status not null default 'PUBLISHED',
  created_by     uuid not null references public.profiles (id) on delete restrict,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint videos_title_check check (char_length(btrim(title)) >= 2)
);

-- La consulta del catálogo: publicados, del más reciente al más antiguo.
create index if not exists videos_status_published_idx
  on public.videos (status, published_at desc);

alter table public.videos enable row level security;
alter table public.videos force row level security;

-- Cualquier autenticado ve los publicados; el admin, todos.
create policy videos_leer on public.videos for select to authenticated
using (status = 'PUBLISHED' or public.es_admin());

-- Solo el admin publica y administra (la autorización primaria vive en el API).
create policy videos_admin on public.videos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Mismo trigger de `updated_at` que el resto de tablas del esquema inicial.
drop trigger if exists videos_tocar_updated_at on public.videos;
create trigger videos_tocar_updated_at
  before update on public.videos
  for each row execute function public.tocar_updated_at();
