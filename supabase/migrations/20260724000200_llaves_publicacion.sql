-- Llaves de publicación: un admin genera un código y se lo da a un maestro de
-- confianza. Con ese código, el maestro publica su borrador SIN pasar por la
-- revisión (excepción autorizada por el admin; ver ADR). Cada llave es de un
-- solo uso: al consumirla, queda ligada al curso y maestro que la usó.
create table if not exists public.publish_keys (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid not null references public.profiles (id) on delete restrict,
  used_by uuid references public.profiles (id) on delete set null,
  used_course_id uuid references public.courses (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists publish_keys_code_idx on public.publish_keys (code);

alter table public.publish_keys enable row level security;
alter table public.publish_keys force row level security;

-- Solo los administradores gestionan las llaves. La validación que hace el
-- maestro al publicar pasa por el API (service role), nunca leyendo la tabla.
create policy publish_keys_admin_all on public.publish_keys
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());
