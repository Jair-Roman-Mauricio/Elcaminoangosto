-- Comentarios de video, abiertos y anónimos.
--
-- Hasta ahora no existían: el endpoint devolvía «no implementado», lo que se
-- veía en pantalla eran personas inventadas y lo que alguien escribía vivía en
-- la memoria del navegador hasta recargar. Un comentario que se pierde es peor
-- que no poder comentar, porque promete algo que no cumple.
--
-- Misma regla que la comunidad (ADR sobre el anonimato, migración
-- 20260803000200): no hay cuentas, así que quien escribe manda un identificador
-- ALEATORIO que su navegador genera y guarda; aquí solo vive su huella sha256.
-- Sirve para dar un alias dentro del video y para frenar a quien publique sin
-- parar. No se guarda IP ni huella del dispositivo (RNF-9).

create table public.video_comentarios (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  cuerpo text not null check (length(btrim(cuerpo)) between 1 and 320),
  autor_huella text not null,
  estado public.estado_publicacion not null default 'VISIBLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- El hilo de un video se lee del más nuevo al más viejo.
create index video_comentarios_por_video
  on public.video_comentarios (video_id, created_at desc);

-- Para el límite por persona: «cuántos ha escrito esta huella últimamente».
create index video_comentarios_por_autor
  on public.video_comentarios (autor_huella, created_at desc);

create trigger video_comentarios_tocar_updated_at
  before update on public.video_comentarios
  for each row execute function public.tocar_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Leer, cualquiera. Escribir, solo por el API: es quien aplica el límite y el
-- que conoce la huella. Sin política de escritura, ni `anon` ni `authenticated`
-- pueden insertar aunque lleguen directos a PostgREST.
alter table public.video_comentarios enable row level security;

create policy video_comentarios_leer on public.video_comentarios
  for select to anon, authenticated
  using (estado = 'VISIBLE' or public.es_admin());

create policy video_comentarios_admin on public.video_comentarios
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

grant select on public.video_comentarios to anon, authenticated;
