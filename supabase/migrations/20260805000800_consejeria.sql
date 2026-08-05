-- Consejería: personas a las que escribir cuando lo que pasa no puede esperar.
--
-- No es contenido que se publica y se olvida: es una lista de gente real con
-- su teléfono, y quien la mira puede estar en su peor día. De ahí dos
-- decisiones:
--
-- 1. `atiende_urgencias` sube al consejero al principio y destaca su contacto.
--    Quien llega al borde no debería tener que leer ocho fichas para saber a
--    quién llamar ahora.
-- 2. Los contactos van en `jsonb` y no en columnas fijas. Cada consejero deja
--    los que quiera —teléfono, WhatsApp, correo, las redes que use— y solo
--    salen esos: un botón que no lleva a nadie es peor que no tenerlo, y aquí
--    el coste de ese fallo lo paga alguien que necesitaba ayuda.

create table public.consejeros (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 2 and 120),
  -- Quién es y en qué puede ayudar. Corto: se lee de un vistazo.
  presentacion text check (presentacion is null or length(btrim(presentacion)) <= 400),
  -- Su papel: «Pastor», «Consejera familiar», «Psicóloga cristiana»…
  rol text check (rol is null or length(btrim(rol)) <= 120),
  foto_asset_id uuid references public.media_assets(id) on delete set null,
  -- De «canal» a dato: {"telefono": "+51...", "correo": "...", "whatsapp": "..."}
  contactos jsonb not null default '{}'::jsonb,
  atiende_urgencias boolean not null default false,
  -- Para ordenar la lista a mano dentro de cada grupo.
  orden integer not null default 0,
  estado public.estado_publicacion not null default 'VISIBLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consejeros
  add constraint consejeros_contactos_es_objeto check (jsonb_typeof(contactos) = 'object');

-- Los de urgencias primero; dentro de cada grupo, el orden que decida el admin.
create index consejeros_orden_idx
  on public.consejeros (atiende_urgencias desc, orden, created_at);

create trigger consejeros_tocar_updated_at
  before update on public.consejeros
  for each row execute function public.tocar_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Leer, cualquiera y sin cuenta: quien necesita este teléfono no está para
-- registrarse. Escribir, solo la administración.
alter table public.consejeros enable row level security;

create policy consejeros_leer on public.consejeros
  for select to anon, authenticated
  using (estado = 'VISIBLE' or public.es_admin());

create policy consejeros_admin on public.consejeros
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

grant select on public.consejeros to anon, authenticated;
