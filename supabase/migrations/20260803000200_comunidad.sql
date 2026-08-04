-- Comunidad: hilos abiertos donde cualquiera pregunta o aporta.
--
-- No hay cuentas, así que tampoco autor. Cada quien lleva un identificador
-- ALEATORIO que su navegador genera y guarda; aquí solo vive su huella sha256.
-- Sirve para dos cosas y ninguna más:
--
--   1. Dar un alias dentro del hilo («Caminante 2»), para que una conversación
--      de ida y vuelta se pueda seguir. El alias se calcula al leer y no sale
--      de ese hilo: la misma persona es «Caminante 2» aquí y otro número allá.
--   2. Poner un límite por persona, para que un guion no llene el foro.
--
-- No se guarda IP ni huella del dispositivo (RNF-9). Quien borre los datos de
-- su navegador aparecerá como alguien nuevo, y eso es aceptable: el objetivo
-- no es identificar a nadie.

create type public.estado_publicacion as enum ('VISIBLE', 'OCULTO');

create table public.hilos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 5 and 140),
  cuerpo text not null check (length(btrim(cuerpo)) between 10 and 5000),
  -- Huella del autor: permite el alias y el límite, no identificar a nadie.
  autor_huella text not null,
  estado public.estado_publicacion not null default 'VISIBLE',
  /* Denormalizado a propósito: el listado ordena por actividad reciente y
     contarlo por hilo en cada carga sería una consulta por fila. */
  respuestas int not null default 0,
  ultima_actividad timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hilo_respuestas (
  id uuid primary key default gen_random_uuid(),
  hilo_id uuid not null references public.hilos(id) on delete cascade,
  cuerpo text not null check (length(btrim(cuerpo)) between 2 and 5000),
  autor_huella text not null,
  estado public.estado_publicacion not null default 'VISIBLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- El listado va siempre por actividad reciente; el hilo, por orden de llegada.
create index hilos_por_actividad on public.hilos (ultima_actividad desc)
  where estado = 'VISIBLE';
create index hilo_respuestas_por_hilo on public.hilo_respuestas (hilo_id, created_at);

-- Para el límite por persona: «cuántos hilos abrió esta huella últimamente».
create index hilos_por_autor on public.hilos (autor_huella, created_at desc);
create index hilo_respuestas_por_autor on public.hilo_respuestas (autor_huella, created_at desc);

create trigger hilos_tocar_updated_at
  before update on public.hilos
  for each row execute function public.tocar_updated_at();

create trigger hilo_respuestas_tocar_updated_at
  before update on public.hilo_respuestas
  for each row execute function public.tocar_updated_at();

/**
 * Mantiene el contador y la actividad del hilo al ritmo de sus respuestas.
 *
 * Va en la base y no en el servicio porque es una invariante del dato: si
 * alguna vez se inserta una respuesta desde otro sitio, el hilo no puede
 * quedarse mintiendo sobre cuántas tiene.
 */
create or replace function public.refrescar_actividad_del_hilo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  objetivo uuid := coalesce(new.hilo_id, old.hilo_id);
begin
  update public.hilos h
  set respuestas = (
        select count(*) from public.hilo_respuestas r
        where r.hilo_id = objetivo and r.estado = 'VISIBLE'
      ),
      ultima_actividad = greatest(
        h.created_at,
        coalesce((
          select max(r.created_at) from public.hilo_respuestas r
          where r.hilo_id = objetivo and r.estado = 'VISIBLE'
        ), h.created_at)
      )
  where h.id = objetivo;
  return null;
end;
$$;

create trigger hilo_respuestas_refrescan_el_hilo
  after insert or update or delete on public.hilo_respuestas
  for each row execute function public.refrescar_actividad_del_hilo();

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Leer, cualquiera. Escribir, solo por el API: es quien aplica los límites y
-- el que conoce la huella del autor. Sin política de escritura, ni `anon` ni
-- `authenticated` pueden insertar aunque lleguen directos a PostgREST.
alter table public.hilos enable row level security;
alter table public.hilo_respuestas enable row level security;

create policy hilos_leer on public.hilos
  for select to anon, authenticated
  using (estado = 'VISIBLE' or public.es_admin());

create policy hilos_admin on public.hilos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy hilo_respuestas_leer on public.hilo_respuestas
  for select to anon, authenticated
  using (estado = 'VISIBLE' or public.es_admin());

create policy hilo_respuestas_admin on public.hilo_respuestas
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Una política no concede nada por sí sola: hace falta el permiso de tabla.
grant select on public.hilos to anon, authenticated;
grant select on public.hilo_respuestas to anon, authenticated;
